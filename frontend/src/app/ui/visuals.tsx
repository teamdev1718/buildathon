import { useState, type ReactNode } from 'react';
import { animalLabel, type AnimalType } from '../lib/programs';
import { IconCut, IconHourglass, IconKnife, IconPackage } from './Icons';
import { IconTruck } from './more-icons';

export type Status = 'PENDING' | 'SLAUGHTERED' | 'PROCESSING' | 'PACKED';
export const statusWord: Record<Status, string> = { PENDING: 'Waiting', SLAUGHTERED: 'Slaughtered', PROCESSING: 'Processing', PACKED: 'Packed' };
export const ordinal = (n: number) => { const v = n % 100; return n + (['th', 'st', 'nd', 'rd'][(v - 20) % 10] ?? ['th', 'st', 'nd', 'rd'][v] ?? 'th'); };
export const when = (value: string) => new Date(value).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export type Step = { key: string; label: string; hint: string; icon: ReactNode };
export const steps: Step[] = [
  { key: 'PENDING', label: 'Waiting', hint: 'In queue for slaughter', icon: <IconHourglass /> },
  { key: 'SLAUGHTERED', label: 'Slaughtered', hint: 'Animal has been slaughtered', icon: <IconKnife /> },
  { key: 'PROCESSING', label: 'Processing', hint: 'Cutting and weighing', icon: <IconCut /> },
  { key: 'PACKED', label: 'Packed', hint: 'Meat is ready for distribution', icon: <IconPackage /> },
];
export const stepsWithDelivery: Step[] = [...steps, { key: 'DISTRIBUTED', label: 'Distributed', hint: 'Meat reached your household', icon: <IconTruck /> }];

/** A horizontal progress stepper. `at` is the index of the current step; steps before it are done. */
export function Stepper({ list, at, label }: { list: Step[]; at: number; label: string }) {
  const last = list.length - 1;
  return <ol className={'am-steps am-steps-' + list.length} aria-label={label}>
    <li className="am-steps-line" aria-hidden="true"><i style={{ width: `${Math.max(0, at) / last * 100}%` }} /></li>
    {list.map((step, index) => <li key={step.key} className={index < at ? 'done' : index === at ? 'now' : ''} aria-current={index === at ? 'step' : undefined}>
      <span className="am-node">{step.icon}</span><b>{step.label}</b><small>{step.hint}</small></li>)}
  </ol>;
}

/** A photo slot: put goat.jpg, sheep.jpg, cow.jpg and camel.jpg in frontend/public/animals and they show here; otherwise a plain tile. */
export function Photo({ type, size }: { type: AnimalType; size?: 'sm' }) {
  const [failed, setFailed] = useState(false);
  return <div className={'am-photo am-photo-' + type.toLowerCase() + (size ? ' ' + size : '')}>
    {!failed && <img src={`/animals/${type.toLowerCase()}.jpg`} alt={animalLabel[type]} loading="lazy" onError={() => setFailed(true)} />}
    {failed && <span aria-hidden="true">{animalLabel[type]}</span>}
  </div>;
}

export function Skyline() {
  return <svg className="am-skyline" viewBox="0 0 420 150" aria-hidden="true">
    <defs><linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8cc9b3" stopOpacity=".55" /><stop offset="1" stopColor="#dcebe2" stopOpacity=".1" /></linearGradient></defs>
    <path d="M0 150V108c40-26 82-30 128-12 30 12 54 14 82-2 40-22 92-22 130 4 34 22 56 18 80 6v46z" fill="url(#sk)" />
    <path d="M232 150v-26c0-22 18-38 42-38s42 16 42 38v26z" fill="#9fd1bd" fillOpacity=".7" /><path d="M274 86v-8" stroke="#8cc9b3" strokeWidth="3" />
    <rect x="334" y="52" width="12" height="98" fill="#9fd1bd" fillOpacity=".75" /><path d="M334 52l6-22 6 22z" fill="#9fd1bd" fillOpacity=".75" />
    <path d="M370 40a16 16 0 1 0 10 28 13 13 0 1 1-10-28z" fill="#b9dccd" />
  </svg>;
}

/** Circular progress used on the payments page. */
export function Ring({ percent, label }: { percent: number; label: string }) {
  const radius = 34, circumference = 2 * Math.PI * radius;
  return <div className="am-ring" role="img" aria-label={label}>
    <svg viewBox="0 0 84 84"><circle cx="42" cy="42" r={radius} fill="none" stroke="#dcebe2" strokeWidth="9" />
      <circle cx="42" cy="42" r={radius} fill="none" stroke="var(--green)" strokeWidth="9" strokeLinecap="round" strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - Math.min(100, percent) / 100)} transform="rotate(-90 42 42)" style={{ transition: 'stroke-dashoffset .9s cubic-bezier(.2,.7,.2,1)' }} /></svg>
    <b>{percent}%</b>
  </div>;
}
