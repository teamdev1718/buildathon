// Shares per animal are fixed by the platform: a goat or sheep is one person's Udhiyya, larger animals are shared by up to seven.
export const animalTypes = ['GOAT', 'SHEEP', 'COW', 'CAMEL'] as const;
export type AnimalKind = (typeof animalTypes)[number];
export const sharesPerAnimal: Record<AnimalKind, number> = { GOAT: 1, SHEEP: 1, COW: 7, CAMEL: 7 };

/** Price of one share, rounded up to a whole rupee. */
export const sharePrice = (price: number, shares: number) => Math.ceil(price / shares);
export const animalsNeeded = (shares: number, perAnimal: number) => Math.ceil(shares / perAnimal);
export const bookingTotal = (shares: number, price: number, perAnimal: number) => shares * sharePrice(price, perAnimal);
