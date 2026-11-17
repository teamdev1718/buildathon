import type { Placed } from '../lib/programs';
import { StatusTrack } from '../pages/VolunteerAnimals';

export function Stepper({ value, onChange, disabled, label = 'shares', singular = 'share' }:
{ value: number; onChange(next: number): void; disabled?: boolean; label?: string; singular?: string }) {
  return <div className="am-stepper" role="group" aria-label={`Number of ${label}`}>
    <button type="button" className="iconbtn" aria-label={`Fewer ${label}`} disabled={disabled || value <= 1} onClick={() => onChange(value - 1)}>−</button>
    <output aria-live="polite"><b>{value}</b><span>{value === 1 ? singular : label}</span></output>
    <button type="button" className="iconbtn" aria-label={`More ${label}`} disabled={disabled || value >= 100} onClick={() => onChange(value + 1)}>+</button>
  </div>;
}

const slotText = (value: string) => new Date(value).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export function PlacedList({ items }: { items: Placed[] }) {
  if (!items.length) return <p className="am-note" style={{ margin: 0 }}>Your animal is assigned after bookings close.</p>;
  return <div className="am-placed">{items.map(item => <div key={item.code} className="am-placed-row">
    <span className="am-code">{item.code}</span>
    <span>{item.shares} {item.shares === 1 ? 'share' : 'shares'}</span>
    <span className="am-sub">{item.drawOrder ? `#${item.drawOrder} in line${item.slotAt ? ' · ' + slotText(item.slotAt) : ''}` : 'Order not drawn yet'}</span>
    {item.status !== 'PENDING' && <div style={{ flexBasis: '100%' }}><StatusTrack status={item.status} /></div>}</div>)}</div>;
}
