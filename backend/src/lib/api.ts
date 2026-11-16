import { Router, type Request, type Response, type RequestHandler } from 'express';
import { z } from 'zod';

export const api = Router();
const paths: Record<string, Record<string, unknown>> = {};
type Method = 'get' | 'post' | 'patch' | 'delete';

export function route<S extends z.ZodType = z.ZodUndefined>(options: {
  method: Method;
  path: string;
  summary: string;
  body?: S;
  status?: number;
  redirect?: boolean;
  protected?: boolean;
  middleware?: RequestHandler[];
}, handler: (input: z.output<S>, req: Request, res: Response) => unknown) {
  const { method, path, body, summary, middleware = [], status = 200 } = options;
  const responses: Record<string, { description: string }> = {
    [options.redirect ? 302 : status]: { description: options.redirect ? 'Browser redirect' : 'Success' },
    default: { description: 'API error with error.code, error.message and error.requestId' },
  };
  (paths[path] ??= {})[method] = {
    summary, responses,
    ...(options.protected ? { security: [{ bearer: [] }] } : {}),
    ...(body ? { requestBody: { required: true, content: {
      'application/json': { schema: z.toJSONSchema(body, { io: 'input' }) },
    } } } : {}),
  };
  api[method](path, ...middleware, async (req, res) => {
    const result = await handler(body?.parse(req.body) as z.output<S>, req, res);
    if (!res.headersSent) res.status(status).json(result);
  });
}

export const openapi = {
  openapi: '3.1.0',
  info: { title: 'Buildathon Starter API', version: '1.0.0' },
  servers: [{ url: '/api/v1' }],
  paths,
  components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
};

