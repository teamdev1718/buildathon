import { z } from 'zod';

export const email = z.string().trim().max(254).pipe(z.email()).transform(value => value.toLowerCase());
export const name = z.string().trim().min(1).max(100);
const password = z.string().min(12).max(128);
const code = z.string().regex(/^\d{6}$/);
export const emailInput = z.strictObject({ email });
export const otpInput = emailInput.extend({ code });
export const registration = emailInput.extend({ name, password });
export const loginInput = emailInput.extend({ password: z.string().min(1).max(128) });
export const loginOtpInput = otpInput.extend({ password: loginInput.shape.password });
export const verifyEmailInput = otpInput.extend({ password });
export const resetInput = verifyEmailInput;

