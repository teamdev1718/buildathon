# AI presets

Import `ai` from `backend/src/modules/ai/ai.service.ts`. These functions are for backend feature modules. They return suggestions for your application to review. The starter adds no AI HTTP routes.

## Configuration

Set these in `backend/.env` for development or in Render's backend environment.

```env
GEMINI_API_KEY=<your Gemini API key>
GEMINI_MODEL=gemini-3.1-flash-lite
CHATBOT_PROVIDER=gemini
```

`GEMINI_API_KEY` enables the three functions. `GEMINI_MODEL` is optional and defaults to `gemini-3.1-flash-lite`. Use a model available to your key that supports structured output via `generateContent`. Set `CHATBOT_PROVIDER=gemini` only if you also want Gemini in chat. The default `faq` leaves chat on local FAQ answers. Gemini chat falls back to FAQ on missing credentials, limits, timeouts, or unusable responses. [Gemini 3.1 Flash-Lite](https://aistudio.google.com/docs/models/gemini-3.1-flash-lite) · [Gemini structured output](https://aistudio.google.com/docs/structured-output)

## Extract structured data

From another backend module, import the service and define a small Zod object for your form:

```ts
import { z } from 'zod';
import { ai } from '../ai/ai.service.js';

const draft = await ai.extract({
  input: 'We have 45 food packets near the bus stand. Collect before 5 PM.',
  schema: z.strictObject({
    quantity: z.number().int().positive(),
    unit: z.string(),
    location: z.string(),
    deadline: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional()
      .describe('The stated pickup deadline in 24-hour HH:mm format. Omit if absent.'),
  }),
});
```

Review `draft` before saving. Use optional fields for facts a draft may omit, and avoid schema defaults. Gemini is instructed to leave absent or ambiguous fields out. If any required field is missing or invalid, the service rejects the entire result and `AiOutputError.fields` identifies the field paths.

## Classify and prioritize

```ts
const suggestion = await ai.classify({
  text: 'My house was damaged by flooding.',
  categories: ['EDUCATION', 'MEDICAL', 'EMERGENCY', 'OTHER'],
});
```

The service returns a supplied category, `LOW`, `MEDIUM`, or `HIGH` priority, a short reason, and `requiresHumanReview: true`. Include `UNKNOWN` or `OTHER` when you want an ambiguous result to have a category. Apply your own eligibility and escalation rules.

## Rank eligible candidates

```ts
// In your application, filter by permissions, capacity and pickup availability first.
const eligible = [
  { id: 'ngo-a', mealsNeeded: 40, distanceKm: 2 },
  { id: 'ngo-c', mealsNeeded: 35, distanceKm: 3 },
];

const { recommendations } = await ai.recommend({
  candidates: eligible,
  criteria: '40 meals available. Rank by suitable capacity and short pickup distance.',
  maxResults: 2,
});
```

The input accepts JSON-compatible candidate fields. Each recommendation has a distinct supplied `candidateId` and a reason. An empty candidate list yields an empty result without contacting Gemini. Check eligibility again when you act on the ranking if availability or permissions may have changed.

## Errors and limits

| Error | Meaning |
| --- | --- |
| Zod error or `INVALID_INPUT` | Input failed validation |
| `AI_INVALID_SCHEMA` | Output schema could not be represented as JSON Schema or defines an extraction default |
| `AI_UNAVAILABLE` | Gemini is unconfigured or the provider request failed |
| `AI_RATE_LIMITED` | Local request budget or Gemini quota was reached |
| `AI_TIMEOUT` | The request exceeded six seconds |
| `AI_EMPTY_RESPONSE`, `AI_INCOMPLETE_RESPONSE`, `AI_INVALID_RESPONSE` | Gemini produced no usable complete response |
| `AI_INVALID_JSON`, `AI_SCHEMA_MISMATCH` | The output could not be parsed or failed validation |

The transport allows 30 Gemini requests per minute per process, shared with the chatbot. Gemini account limits also apply. Text inputs are capped at 12,000 characters. Matching accepts up to 50 candidates and 20 results, with a 24,000-character serialized payload limit. These functions process text and JSON. They send the supplied input to Gemini, so pass only fields your application is authorized to share. Schema validation checks structure and values, and a person should still verify model claims against the original input.
