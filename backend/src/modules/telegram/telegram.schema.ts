import { z } from 'zod';

export const telegramUpdate = z.object({
  update_id: z.number().int().nonnegative(),
  message: z.object({
    chat: z.object({ id: z.number().int(), type: z.string() }),
    text: z.string().max(4096).optional(),
  }).optional(),
});
export type TelegramUpdate = z.infer<typeof telegramUpdate>;

