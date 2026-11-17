import { z } from 'zod';
import { ApiError } from '../../lib/http.js';

export const id = z.uuid();
export const rupees = z.number().int().min(1).max(10_000_000);
const day = z.iso.date().transform(value => new Date(value + 'T00:00:00.000Z'));
const text = (max: number) => z.string().trim().min(1).max(max);

export const idParam = (value: unknown) => {
  const parsed = id.safeParse(value);
  if (!parsed.success) throw new ApiError(404, 'NOT_FOUND', 'Not found.');
  return parsed.data;
};

export const cycleInput = z.strictObject({
  name: text(80),
  targetDate: day,
  priceLockDate: day,
  familyPercent: z.number().int().min(0).max(100).default(33),
  relativesPercent: z.number().int().min(0).max(100).default(33),
  poorPercent: z.number().int().min(0).max(100).default(34),
  meatKgPerShare: z.number().int().min(1).max(100).default(10),
  slots: z.array(text(40)).max(24).default([]),
}).refine(v => v.familyPercent + v.relativesPercent + v.poorPercent === 100, { message: 'Percentages must total 100.' })
  .refine(v => v.priceLockDate < v.targetDate, { message: 'Price lock must be before the Udhiyya date.' });

export const planInput = z.strictObject({
  name: text(60),
  animalType: z.enum(['GOAT', 'SHEEP', 'COW', 'CAMEL']),
  sharePrice: rupees,
  sharesPerAnimal: z.number().int().min(1).max(7),
}).refine(v => ['COW', 'CAMEL'].includes(v.animalType) || v.sharesPerAnimal === 1,
  { message: 'Goats and sheep have one share per animal.' });

export const statusInput = z.strictObject({ status: z.enum(['PROCUREMENT', 'DISTRIBUTION', 'CLOSED']) });

export const animalInput = z.strictObject({
  animalType: z.enum(['GOAT', 'SHEEP', 'COW', 'CAMEL']),
  label: text(60),
  weightKg: z.number().int().min(1).max(2000).optional(),
  cost: rupees.optional(),
  seller: text(80).optional(),
});

export const enrollInput = z.strictObject({
  planId: id,
  shares: z.number().int().min(1).max(7),
  holderNames: z.array(text(60)).min(1).max(7),
}).refine(v => v.holderNames.length === v.shares, { message: 'Give one name per share.' });

export const onlinePaymentInput = z.strictObject({ amount: rupees, reference: text(40) });
export const cashPaymentInput = z.strictObject({ amount: rupees });

export const beneficiaryInput = z.strictObject({
  name: text(80),
  phone: z.string().trim().regex(/^[0-9+\- ]{6,20}$/).optional(),
  area: text(60),
  address: text(200).optional(),
  needsDelivery: z.boolean().default(false),
});

export const collectorInput = z.strictObject({ email: z.email().transform(value => value.toLowerCase()), enabled: z.boolean() });
export const collectInput = z.strictObject({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{10}$/) });
