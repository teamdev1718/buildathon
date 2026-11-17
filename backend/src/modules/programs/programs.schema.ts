import { z } from 'zod';
import { animalTypes } from './programs.logic.js';

const text = (max: number) => z.string().trim().min(1).max(max);
const day = z.iso.date().transform(value => new Date(value + 'T00:00:00.000Z'));

export const animalType = z.enum(animalTypes);
export const programInput = z.strictObject({
  name: text(80),
  year: z.number().int().min(2024).max(2100),
  targetDate: day,
  description: text(500).optional(),
});
export const programUpdate = programInput.partial();
export const animalUpdate = z.strictObject({
  price: z.number().int().min(0).max(10_000_000).optional(),
  enabled: z.boolean().optional(),
});
export const bookingInput = z.strictObject({
  householdId: z.uuid(),
  animalType,
  shares: z.number().int().min(1).max(100),
  payMode: z.enum(['ONE_TIME', 'INSTALLMENTS']).default('INSTALLMENTS'),
});
export const bookingUpdate = z.strictObject({
  shares: z.number().int().min(1).max(100).optional(),
  payMode: z.enum(['ONE_TIME', 'INSTALLMENTS']).optional(),
});
export const empty = z.strictObject({});
