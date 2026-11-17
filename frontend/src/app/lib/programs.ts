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
  id: string; animalType: AnimalType; shares: number; payMode: PayMode; amount: number; animals: Placed[]; autopay: boolean; bookedAt: string;
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

export type PlanRow = { label: string; due: string; amount: number; state: 'PAID' | 'DUE' | 'OVERDUE' | 'UPCOMING'; paidOn: string | null };

/** The month-by-month plan: payments are applied to the earliest instalments first. */
export function planRows(booking: MyBooking, payBy: string, now = new Date()): PlanRow[] {
  const total = booking.money.total;
  const confirmed = booking.payments.filter(item => item.status === 'CONFIRMED').sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  const count = booking.payMode === 'ONE_TIME' ? 1 : Math.max(1, booking.money.installments);
  const monthly = booking.payMode === 'ONE_TIME' ? total : booking.money.monthlyAmount;
  const limit = new Date(payBy);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const rows: PlanRow[] = [];
  let needed = 0, firstOpen = true;
  for (let i = 0; i < count; i++) {
    const amount = i === count - 1 ? Math.max(0, total - monthly * (count - 1)) : monthly;
    needed += amount;
    const start = new Date(booking.bookedAt);
    const due = booking.payMode === 'ONE_TIME' ? limit : new Date(Math.min(new Date(start.setUTCMonth(start.getUTCMonth() + i)).getTime(), limit.getTime()));
    let running = 0, paidOn: string | null = null;
    for (const item of confirmed) { running += item.amount; if (running >= needed) { paidOn = item.createdAt; break; } }
    const paid = booking.money.paid >= needed;
    let state: PlanRow['state'] = 'UPCOMING';
    if (paid) state = 'PAID';
    else if (firstOpen) { state = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate()) < +today ? 'OVERDUE' : 'DUE'; firstOpen = false; }
    rows.push({ label: booking.payMode === 'ONE_TIME' ? 'Full payment' : due.toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
      due: due.toISOString(), amount, state, paidOn: paid ? paidOn ?? due.toISOString() : null });
  }
  return rows;
}
