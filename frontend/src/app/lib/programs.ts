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
export const animalEmoji: Record<AnimalType, string> = { GOAT: '🐐', SHEEP: '🐑', COW: '🐄', CAMEL: '🐪' };
export const shareText = (per: number) => (per === 1 ? 'One person per animal' : `Shared by up to ${per}`);
export const statusLabel = { DRAFT: 'Draft', OPEN: 'Open', ENDED: 'Ended' } as const;

/** Splits a name so the last word can be set in the italic serif accent, as in "Udhiyya *2027*". */
export const splitName = (name: string) => { const at = name.lastIndexOf(' '); return at < 0 ? ['', name] as const : [name.slice(0, at + 1), name.slice(at + 1)] as const; };
