import type { FC } from 'react';

const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24' } as const;
type P = { className?: string };

export const IconEdit: FC<P> = ({ className }) => <svg {...base} className={className}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4" /></svg>;
export const IconGear: FC<P> = ({ className }) => <svg {...base} className={className}><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" /></svg>;
export const IconClipboard: FC<P> = ({ className }) => <svg {...base} className={className}><rect x="5" y="4" width="14" height="17" rx="3" /><path d="M9 4h6v3H9zM9 12h6M9 16h4" /></svg>;
export const IconPlus: FC<P> = ({ className }) => <svg {...base} className={className}><path d="M12 5v14M5 12h14" /></svg>;
export const IconArrowRight: FC<P> = ({ className }) => <svg {...base} className={className}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
export const IconSearchSmall: FC<P> = ({ className }) => <svg {...base} className={className}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
