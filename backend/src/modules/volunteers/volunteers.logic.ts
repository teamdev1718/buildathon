import { randomInt } from 'node:crypto';

// Letters and digits that cannot be mistaken for each other when read aloud or copied from a screen.
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

export function generatePassword(random: (limit: number) => number = randomInt) {
  const chars = Array.from({ length: 12 }, () => alphabet[random(alphabet.length)]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8)}`;
}

export function generateUsername(mahalluCode: string, name: string, random: (limit: number) => number = randomInt) {
  const slug = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '').slice(0, 12) || 'volunteer';
  return `${mahalluCode.toLowerCase().replace(/[^a-z0-9]/g, '')}-${slug}-${random(9000) + 1000}`;
}

export const volunteerEmail = (username: string) => `${username}@volunteer.invalid`;

export const statusOrder = ['PENDING', 'SLAUGHTERED', 'PROCESSING', 'PACKED'] as const;
export type Status = (typeof statusOrder)[number];
/** Volunteers move an animal forward one step at a time; admins can set any status to correct a mistake. */
export const isNextStatus = (from: Status, to: Status) => statusOrder.indexOf(to) === statusOrder.indexOf(from) + 1;
