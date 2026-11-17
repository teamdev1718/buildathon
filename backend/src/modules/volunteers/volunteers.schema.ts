import { z } from 'zod';

const text = (max: number) => z.string().trim().min(1).max(max);
export const status = z.enum(['PENDING', 'SLAUGHTERED', 'PROCESSING', 'PACKED']);

export const volunteerInput = z.strictObject({
  name: text(80),
  phone: z.string().trim().regex(/^[0-9+\- ]{6,20}$/).optional(),
  canStatus: z.boolean(),
  canDistribute: z.boolean(),
}).refine(value => value.canStatus || value.canDistribute, { message: 'Give the volunteer at least one role.' });

export const volunteerUpdate = z.strictObject({
  name: text(80).optional(), canStatus: z.boolean().optional(), canDistribute: z.boolean().optional(),
});
export const volunteerLogin = z.strictObject({ username: z.string().trim().toLowerCase().min(3).max(60), password: z.string().min(1).max(100) });
export const issueInput = z.strictObject({ packets: z.number().int().min(1).max(100_000), note: text(200).optional() });
export const distributeInput = z.strictObject({ householdId: z.uuid(), packets: z.number().int().min(1).max(1000) });
export const statusInput = z.strictObject({ status });
