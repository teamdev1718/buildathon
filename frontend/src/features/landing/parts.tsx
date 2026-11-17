import type { CSSProperties, ReactNode } from 'react';

const icons = {
  wallet: 'M3 7a2 2 0 0 1 2-2h13v4M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2zM16 14h.01',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  truck: 'M1 3h15v13H1zM16 8h4l3 3v5h-7zM5.5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18.5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  chart: 'M18 20V10M12 20V4M6 20v-6',
  check: 'M20 6 9 17l-5-5',
  spark: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  arrow: 'M7 17 17 7M8 7h9v9',
  tag: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
  qr: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v.01M14 20h3M20 18v3',
  home: 'M3 11 12 3l9 8M5 10v10h5v-6h4v6h5V10',
};
export type IconName = keyof typeof icons;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icons[name]} /></svg>;
}

export function Tag({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return <span className={'lp-tag' + (dark ? ' lp-tag-dark' : '')}><i />{children}</span>;
}

export function Heading({ bold, italic, as: Tag = 'h2', className = '' }:
{ bold: string; italic: string; as?: 'h1' | 'h2'; className?: string }) {
  return <Tag className={'lp-heading ' + className}>{bold} <em>{italic}</em></Tag>;
}

export function Phone({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={'lp-phone ' + className} aria-hidden="true">
    <div className="lp-phone-notch" />
    <div className="lp-phone-status"><span>9:41</span><span>●●●</span></div>
    <div className="lp-phone-body">{children}</div>
  </div>;
}

export function Row({ icon, title, sub, value, tone = 'dark' }:
{ icon: IconName; title: string; sub: string; value: string; tone?: 'dark' | 'mid' | 'light' }) {
  return <div className="lp-row">
    <span className={'lp-dot lp-dot-' + tone}><Icon name={icon} size={16} /></span>
    <span className="lp-row-text"><b>{title}</b><small>{sub}</small></span>
    <span className="lp-row-value">{value}</span>
  </div>;
}

export function FloatCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={'lp-float ' + className} aria-hidden="true">{children}</div>;
}

export function Bars({ values, highlight }: { values: number[]; highlight?: number }) {
  return <div className="lp-bars" aria-hidden="true">
    {values.map((value, index) => <span key={index} className={index === highlight ? 'on' : ''} style={{ height: value + '%', '--i': index } as CSSProperties} />)}
  </div>;
}

export function Meter({ percent, label }: { percent: number; label: string }) {
  return <div className="lp-meter" role="img" aria-label={label}><span style={{ width: percent + '%' }} /></div>;
}
