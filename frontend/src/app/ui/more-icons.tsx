import type { FC } from 'react';

const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24' } as const;
type P = { className?: string };

export const IconUser: FC<P> = ({ className }) => <svg {...base} className={className}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></svg>;
export const IconMail: FC<P> = ({ className }) => <svg {...base} className={className}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></svg>;
export const IconLock: FC<P> = ({ className }) => <svg {...base} className={className}><rect x="5" y="11" width="14" height="10" rx="3" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;
export const IconPhone: FC<P> = ({ className }) => <svg {...base} className={className}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg>;
export const IconWallet: FC<P> = ({ className }) => <svg {...base} className={className}><path d="M3 7a2 2 0 0 1 2-2h13v4M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z" /><circle cx="16.5" cy="14" r="1" /></svg>;
export const IconReceipt: FC<P> = ({ className }) => <svg {...base} className={className}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" /></svg>;
export const IconCalendar: FC<P> = ({ className }) => <svg {...base} className={className}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>;
export const IconPulse: FC<P> = ({ className }) => <svg {...base} className={className}><path d="M3 12h4l3-8 4 16 3-8h4" /></svg>;
export const IconPlusCircle: FC<P> = ({ className }) => <svg {...base} className={className}><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>;
export const IconTruck: FC<P> = ({ className }) => <svg {...base} className={className}><path d="M2 6h12v10H2zM14 9h4l4 4v3h-8zM6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" /></svg>;
export const IconMegaphone: FC<P> = ({ className }) => <svg {...base} className={className}><path d="M3 11v3h3l7 4V7L6 11zM17 8a5 5 0 0 1 0 8" /></svg>;
export const IconAnimal: FC<P> = ({ className }) => <svg {...base} className={className}><path d="M4 9c0-2 1-4 3-4 1.5 0 2 1 3 1h4c1 0 1.5-1 3-1 2 0 3 2 3 4l-1.5 2v6H16v-3H8v3H5.5v-6zM9 10.5h.01M15 10.5h.01" /></svg>;
export const IconInfoCircle: FC<P> = ({ className }) => <svg {...base} className={className}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>;
export const IconUpcoming: FC<P> = ({ className }) => <svg {...base} className={className}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
