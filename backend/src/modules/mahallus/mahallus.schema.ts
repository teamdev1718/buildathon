import { z } from 'zod';

const text = (max: number) => z.string().trim().min(1).max(max);
export const digits = (value: string) => value.replace(/\D/g, '');
/** Phones are compared by their last ten digits so +91 and spacing never matter. */
export const normalizePhone = (value: string) => digits(value).slice(-10);

export const mahalluInput = z.strictObject({
  name: text(80),
  district: text(60),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,16}$/, 'Use 3 to 16 letters or digits.'),
});
export const mahalluUpdate = z.strictObject({
  name: text(80).optional(), district: text(60).optional(), active: z.boolean().optional(),
});
export const adminInput = z.strictObject({
  email: z.email().transform(value => value.toLowerCase()), enabled: z.boolean(),
});

export const householdInput = z.strictObject({
  mahalluNumber: text(20),
  ownerName: text(100),
  memberCount: z.coerce.number().int().min(1).max(60),
  address: text(250),
  phone: z.string().trim().refine(value => normalizePhone(value).length === 10, 'Phone needs 10 digits.'),
});
export const householdUpdate = householdInput.partial();
export const importInput = z.strictObject({ rows: z.array(z.unknown()).min(1).max(2000) });

export const linkInput = z.strictObject({
  mahalluId: z.uuid(),
  mahalluNumber: text(20),
  phone: z.string().trim().refine(value => normalizePhone(value).length === 10, 'Phone needs 10 digits.'),
});
