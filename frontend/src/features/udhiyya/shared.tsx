import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api } from '../../api/client';

export const rupees = (amount: number) => '₹' + amount.toLocaleString('en-IN');
export const kg = (grams: number) => (grams / 1000).toLocaleString('en-IN', { maximumFractionDigits: 1 }) + ' kg';
export const day = (value: string) => new Date(value).toLocaleDateString('en-IN', { dateStyle: 'medium' });

export type Plan = { id: string; name: string; animalType: string; sharePrice: number; sharesPerAnimal: number };
export type Cycle = {
  id: string; name: string; targetDate: string; priceLockDate: string; status: string;
  familyPercent: number; relativesPercent: number; poorPercent: number; meatKgPerShare: number;
  slots: string[]; plans: Plan[];
};
export type Payment = { id: string; amount: number; method: string; status: string; reference: string | null; createdAt: string };
export type Enrollment = {
  id: string; planName: string; shares: number; holderNames: string[]; totalAmount: number; installments: number;
  monthlyAmount: number; confirmed: number; pending: number; remaining: number; expected: number;
  standing: 'PAID' | 'ON_TRACK' | 'BEHIND'; payments: Payment[];
};

/** Loads authenticated data and exposes reload so actions can refresh the screen. */
export function useLoad<T>(path: string | null) {
  const [state, setState] = useState<{ data: T | null; error: string; loading: boolean }>({ data: null, error: '', loading: !!path });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    let active = true;
    api<T>(path, 'GET', undefined, true).then(
      data => { if (active) setState({ data, error: '', loading: false }); },
      error => { if (active) setState({ data: null, loading: false, error: error instanceof Error ? error.message : 'Could not load.' }); },
    );
    return () => { active = false; };
  }, [path, tick]);
  const reload = useCallback(() => setTick(value => value + 1), []);
  return { ...state, reload };
}

export function Loaded<T>({ result, children }: { result: { data: T | null; error: string; loading: boolean }; children(data: T): ReactNode }) {
  if (result.loading) return <p role="status">Loading…</p>;
  if (result.error || !result.data) return <p className="notice error" role="alert">{result.error || 'Nothing to show.'}</p>;
  return <>{children(result.data)}</>;
}

const labels: Record<string, string> = { PAID: 'Fully paid', ON_TRACK: 'On track', BEHIND: 'Behind schedule' };
export function Standing({ value }: { value: Enrollment['standing'] }) {
  return <span className={'badge ' + value.toLowerCase()}>{labels[value]}</span>;
}

export function Progress({ done, total, label }: { done: number; total: number; label: string }) {
  const percent = total ? Math.min(100, Math.round(done / total * 100)) : 0;
  return <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
    <span style={{ width: percent + '%' }} />
  </div>;
}
