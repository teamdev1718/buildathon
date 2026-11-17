// Shares per animal are fixed by the platform: a goat or sheep is one person's Udhiyya, larger animals are shared by up to seven.
export const animalTypes = ['GOAT', 'SHEEP', 'COW', 'CAMEL'] as const;
export type AnimalKind = (typeof animalTypes)[number];
export const sharesPerAnimal: Record<AnimalKind, number> = { GOAT: 1, SHEEP: 1, COW: 7, CAMEL: 7 };

/** Price of one share, rounded up to a whole rupee. */
export const sharePrice = (price: number, shares: number) => Math.ceil(price / shares);
export const animalsNeeded = (shares: number, perAnimal: number) => Math.ceil(shares / perAnimal);
export const bookingTotal = (shares: number, price: number, perAnimal: number) => shares * sharePrice(price, perAnimal);

export const codePrefix: Record<AnimalKind, string> = { GOAT: 'GOT', SHEEP: 'SHP', COW: 'COW', CAMEL: 'CML' };
export const animalCode = (type: AnimalKind, number: number) => `${codePrefix[type]}-${String(number).padStart(2, '0')}`;

export type Placement = { bookingId: string; animal: number; shares: number };

/**
 * Packs bookings into exactly ceil(total shares / capacity) animals. A booking goes whole into the tightest animal that still
 * has room; only when none has, it is split across the emptiest animals, so no animal is ever added beyond the minimum.
 */
export function planAllocation(bookings: { id: string; shares: number }[], capacity: number) {
  const total = bookings.reduce((sum, item) => sum + item.shares, 0);
  const animals = animalsNeeded(total, capacity);
  const room = Array<number>(animals).fill(capacity);
  const placements: Placement[] = [];
  // Equal sizes keep their booking order (a stable sort), so earlier bookings are placed first and results repeat exactly.
  const sorted = [...bookings].sort((a, b) => b.shares - a.shares);
  for (const booking of sorted) {
    let left = booking.shares;
    let best = -1;
    room.forEach((free, index) => { if (free >= left && (best < 0 || free < room[best])) best = index; });
    if (best >= 0) {
      room[best] -= left;
      placements.push({ bookingId: booking.id, animal: best, shares: left });
      continue;
    }
    while (left > 0) {
      let emptiest = 0;
      room.forEach((free, index) => { if (free > room[emptiest]) emptiest = index; });
      const take = Math.min(left, room[emptiest]);
      room[emptiest] -= take;
      left -= take;
      placements.push({ bookingId: booking.id, animal: emptiest, shares: take });
    }
  }
  return { animals, placements };
}

/** Fisher-Yates with an injected random source so the draw can be unbiased in production and repeatable in tests. */
export function shuffle<T>(items: T[], randomBelow: (limit: number) => number) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomBelow(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const slotAt = (start: Date, minutes: number, position: number) => new Date(start.getTime() + (position - 1) * minutes * 60_000);
