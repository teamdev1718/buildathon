export type AnimalType = 'GOAT' | 'SHEEP' | 'COW' | 'CAMEL';
export type PayMode = 'ONE_TIME' | 'INSTALLMENTS';
export type Animal = { animalType: AnimalType; price: number; enabled: boolean; sharesPerAnimal: number; sharePrice: number };
export type Program = {
  id: string; mahalluId: string; name: string; year: number; targetDate: string; description: string | null;
  status: 'DRAFT' | 'OPEN' | 'ENDED'; payBy: string; payByCustom: boolean; animals: Animal[];
};

export const inr = (amount: number) => '₹' + amount.toLocaleString('en-IN');
export const dateText = (value: string) => new Date(value).toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'UTC' });
export const animalLabel: Record<AnimalType, string> = { GOAT: 'Goat', SHEEP: 'Sheep', COW: 'Cow', CAMEL: 'Camel' };
export const shareText = (per: number) => (per === 1 ? 'One person per animal' : `Shared by up to ${per}`);
export const statusLabel = { DRAFT: 'Draft', OPEN: 'Open', ENDED: 'Ended' } as const;

/** Splits a name so the last word can be set in the italic serif accent, as in "Udhiyya *2027*". */
export const splitName = (name: string) => { const at = name.lastIndexOf(' '); return at < 0 ? ['', name] as const : [name.slice(0, at + 1), name.slice(at + 1)] as const; };

export type Placed = { code: string; shares: number; drawOrder: number | null; slotAt: string | null; status: 'PENDING' | 'SLAUGHTERED' | 'PROCESSING' | 'PACKED' };
export type MyBooking = {
  id: string; animalType: AnimalType; shares: number; payMode: PayMode; amount: number; animals: Placed[]; autopay: boolean;
  money: import('../pages/PaymentPanel').Money; payments: import('../pages/PaymentPanel').PaymentRow[];
};
export type MyProgram = Program & { mahalluName: string; household: { id: string; ownerName: string; mahalluNumber: string }; bookings: MyBooking[] };

export const payModeLabel: Record<PayMode, string> = { INSTALLMENTS: 'Installments', ONE_TIME: 'One-time payment' };

/** Rough monthly amount for the choice screen; the server works out the exact schedule when the booking is made. */
export function monthlyEstimate(total: number, payBy: string, now = new Date()) {
  const end = new Date(payBy);
  const months = (end.getUTCFullYear() - now.getUTCFullYear()) * 12 + end.getUTCMonth() - now.getUTCMonth() - (end.getUTCDate() < now.getUTCDate() ? 1 : 0);
  const count = Math.max(1, months);
  return { months: count, monthly: Math.ceil(total / count) };
}
