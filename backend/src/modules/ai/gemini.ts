import { z } from 'zod';
import { env } from '../../config/env.js';
import { ApiError } from '../../lib/http.js';

const reply = z.object({
  candidates: z.array(z.object({
    finishReason: z.string().optional(),
    content: z.object({
      parts: z.array(z.object({ text: z.string().optional(), thought: z.boolean().optional() })).optional(),
    }).optional(),
  })).optional(),
});

const timeoutMs = 6000;
const callsPerMinute = 30;
let windowStart = 0;
let calls = 0;

export async function generateGemini(options: {
  input: string;
  instructions: string;
  maxOutputTokens: number;
  jsonSchema?: Record<string, unknown>;
}, request = fetch) {
  if (!env.GEMINI_API_KEY) throw new ApiError(503, 'AI_UNAVAILABLE', 'Gemini is not configured.');

  const now = Date.now();
  if (now - windowStart >= 60_000) {
    windowStart = now;
    calls = 0;
  }
  if (calls >= callsPerMinute) throw new ApiError(429, 'AI_RATE_LIMITED', 'AI request limit reached. Try again shortly.');
  calls++;

  const signal = AbortSignal.timeout(timeoutMs);
  let payload: unknown;
  try {
    const response = await request('https://generativelanguage.googleapis.com/v1beta/models/' +
      env.GEMINI_MODEL + ':generateContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        redirect: 'error',
        signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: options.instructions }] },
          contents: [{ role: 'user', parts: [{ text: options.input }] }],
          generationConfig: {
            maxOutputTokens: options.maxOutputTokens,
            ...(options.jsonSchema ? { responseMimeType: 'application/json', responseJsonSchema: options.jsonSchema } : {}),
          },
        }),
      });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 429) throw new ApiError(429, 'AI_RATE_LIMITED', 'Gemini rate limit reached. Try again shortly.');
      throw new ApiError(503, 'AI_UNAVAILABLE', 'Gemini is unavailable.');
    }
    payload = await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (signal.aborted || error instanceof Error && error.name === 'TimeoutError') {
      throw new ApiError(504, 'AI_TIMEOUT', 'Gemini took too long to respond.');
    }
    if (error instanceof SyntaxError) throw new ApiError(502, 'AI_INVALID_RESPONSE', 'Gemini returned an invalid response.');
    throw new ApiError(503, 'AI_UNAVAILABLE', 'Gemini is unavailable.');
  }

  const parsed = reply.safeParse(payload);
  if (!parsed.success) throw new ApiError(502, 'AI_INVALID_RESPONSE', 'Gemini returned an invalid response.');
  const candidate = parsed.data.candidates?.[0];
  const text = candidate?.content?.parts?.filter(part => !part.thought)
    .map(part => part.text ?? '').join('').trim();
  if (!text) throw new ApiError(502, 'AI_EMPTY_RESPONSE', 'Gemini returned no usable text.');
  if (candidate?.finishReason !== 'STOP') {
    throw new ApiError(502, 'AI_INCOMPLETE_RESPONSE', 'Gemini did not complete its response.');
  }
  return text;
}
