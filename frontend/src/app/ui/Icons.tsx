import React from 'react';

export const IconBell: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} stroke="currentColor">
    <path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
    <path d="M13.7 20a2 2 0 01-3.4 0" />
  </svg>
);

export const IconHome: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} stroke="currentColor">
    <path d="M3 10.5L12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
    <path d="M9.5 21v-6h5v6" />
  </svg>
);

export const IconHeart: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} stroke="currentColor">
    <path d="M19.8 5.1a5 5 0 00-7.1 0L12 5.8l-.7-.7a5 5 0 10-7.1 7.1l7.8 7.8 7.8-7.8a5 5 0 000-7.1z" />
  </svg>
);

export const IconCompass: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} stroke="currentColor">
    <circle cx="12" cy="12" r="9.2" />
    <path d="M15.5 8.5l-2 5-5 2 2-5z" />
  </svg>
);

export const IconDoc: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} stroke="currentColor">
    <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6M9 17h4" />
  </svg>
);

export const IconGrid: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" className={className} stroke="currentColor">
    <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
  </svg>
);

export const IconCalc: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" className={className} stroke="currentColor">
    <rect x="5" y="2.8" width="14" height="18.4" rx="2.5" />
    <path d="M8.5 6.5h7M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5h.01M8.5 18h.01M12 18h.01M15.5 18h.01" />
  </svg>
);

export const IconCheck: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className} stroke="currentColor">
    <path d="M4.5 12.5l5 5 10-11" />
  </svg>
);

export const IconX: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" className={className} stroke="currentColor">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const IconInfo: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} stroke="currentColor">
    <circle cx="12" cy="12" r="9.5" />
    <line x1="12" y1="16" x2="12" y2="11.5" />
    <circle cx="12" cy="7.5" r="0.75" fill="currentColor" strokeWidth="1" />
  </svg>
);

export const IconShield: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} stroke="currentColor">
    <path d="M12 3l7.5 3v5.5c0 4.6-3.2 7.9-7.5 9.5C7.7 19.4 4.5 16.1 4.5 11.5V6z" />
    <path d="M9 11.8l2.2 2.2 4-4.2" />
  </svg>
);

export const IconHand: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} stroke="currentColor">
    <path d="M11 11.5V6a1.6 1.6 0 013.2 0v4.5V4.8a1.6 1.6 0 013.2 0V11l1.8 1a2.4 2.4 0 011.1 3.1l-1.7 3.6A6 6 0 0113.2 22h-1.6a6 6 0 01-4.7-2.3L4 15.9a2.3 2.3 0 013.4-3L9 14.5V7a1.6 1.6 0 013.2 0" />
  </svg>
);

export const IconCard: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" className={className} stroke="currentColor">
    <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
    <path d="M3 10h18M7 15h4" />
  </svg>
);

export const IconChart: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" className={className} stroke="currentColor">
    <path d="M4 20V10M10 20V4M16 20v-8M21 20H3" />
  </svg>
);

export const IconBook: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} stroke="currentColor">
    <path d="M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5z" />
    <path d="M4 19.5A2.5 2.5 0 006.5 22H20v-5" />
  </svg>
);

export const IconUsers: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} stroke="currentColor">
    <circle cx="9" cy="8.5" r="3.5" />
    <path d="M3 20c.6-3.4 3-5 6-5s5.4 1.6 6 5" />
    <path d="M16 5.4a3.5 3.5 0 010 6.2M18.5 15.3c1.4.8 2.3 2.3 2.6 4.7" />
  </svg>
);

export const IconChevronRight: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} stroke="currentColor">
    <path d="M9 5l7 7-7 7" />
  </svg>
);

export const IconBack: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} stroke="currentColor">
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

export const IconDownload: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} stroke="currentColor">
    <path d="M12 4v11M7 11l5 5 5-5" />
    <path d="M4.5 20h15" />
  </svg>
);

export const IconRefresh: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} stroke="currentColor">
    <path d="M20 12a8 8 0 10-2.3 5.6" />
    <path d="M20 12V6.5M20 12h-5.5" />
  </svg>
);

export const IconSend: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} stroke="currentColor">
    <path d="M21 3L10.5 13.5M21 3l-6.8 18-3.7-7.5L3 9.8z" />
  </svg>
);

export const IconClock: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" className={className} stroke="currentColor">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </svg>
);

export const IconSearch: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className={className} stroke="currentColor">
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);

export const IconMenu: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} stroke="currentColor">
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

export const IconLayoutDashboard: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} stroke="currentColor">
    <rect x="3" y="3" width="7" height="9" rx="2" />
    <rect x="14" y="3" width="7" height="5" rx="2" />
    <rect x="14" y="12" width="7" height="9" rx="2" />
    <rect x="3" y="16" width="7" height="5" rx="2" />
  </svg>
);

export const IconArrowUpRight: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} stroke="currentColor">
    <line x1="7" y1="17" x2="17" y2="7" />
    <polyline points="7 7 17 7 17 17" />
  </svg>
);

export const IconBox: React.FC<{ name: string; cls?: string }> = ({ name, cls }) => {
  let inner = null;
  switch (name) {
    case 'bell': inner = <IconBell />; break;
    case 'home': inner = <IconHome />; break;
    case 'heart': inner = <IconHeart />; break;
    case 'compass': inner = <IconCompass />; break;
    case 'doc': inner = <IconDoc />; break;
    case 'grid': inner = <IconGrid />; break;
    case 'calc': inner = <IconCalc />; break;
    case 'check': inner = <IconCheck />; break;
    case 'x': inner = <IconX />; break;
    case 'shield': inner = <IconShield />; break;
    case 'hand': inner = <IconHand />; break;
    case 'card': inner = <IconCard />; break;
    case 'chart': inner = <IconChart />; break;
    case 'book': inner = <IconBook />; break;
    case 'users': inner = <IconUsers />; break;
    case 'download': inner = <IconDownload />; break;
    case 'refresh': inner = <IconRefresh />; break;
    case 'send': inner = <IconSend />; break;
    case 'clock': inner = <IconClock />; break;
    default: inner = <IconHeart />;
  }

  return (
    <span className={`ic ${cls || ''}`} aria-hidden="true">
      {inner}
    </span>
  );
};

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24' } as const;
export const IconHourglass: React.FC<{ className?: string }> = ({ className }) => (
  <svg {...stroke} className={className}><path d="M6 2h12M6 22h12M7 2v4a5 5 0 0 0 2 4l1 2-1 2a5 5 0 0 0-2 4v4M17 2v4a5 5 0 0 1-2 4l-1 2 1 2a5 5 0 0 1 2 4v4" /></svg>
);
export const IconKnife: React.FC<{ className?: string }> = ({ className }) => (
  <svg {...stroke} className={className}><path d="M4 20 16 8M13 3c4 0 8 4 8 8-4-.5-7-1-9-3-1.5-1.5-2-3-2.5-5z" /></svg>
);
export const IconCut: React.FC<{ className?: string }> = ({ className }) => (
  <svg {...stroke} className={className}><path d="M5 12c0-4 3-7 7-7 5 0 8 3 8 8 0 4-3 7-8 7-4 0-7-4-7-8z" /><path d="M10 12a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0z" /></svg>
);
export const IconPackage: React.FC<{ className?: string }> = ({ className }) => (
  <svg {...stroke} className={className}><path d="M21 8 12 3 3 8v8l9 5 9-5zM3.3 8 12 13l8.7-5M12 22V13" /></svg>
);
export const IconLayers: React.FC<{ className?: string }> = ({ className }) => (
  <svg {...stroke} className={className}><path d="M12 3 3 8l9 5 9-5-9-5zM3 12.5l9 5 9-5M3 17l9 5 9-5" /></svg>
);
export const IconTag: React.FC<{ className?: string }> = ({ className }) => (
  <svg {...stroke} className={className}><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01" /></svg>
);
