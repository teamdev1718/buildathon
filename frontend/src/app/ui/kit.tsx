import { useCallback, useEffect, useId, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { api } from '../../api/client';

export function PageHead({ eyebrow, title, sub, action }: { eyebrow: ReactNode; title: ReactNode; sub?: string; action?: ReactNode }) {
  return <div className="pagehead"><div className="am-headrow"><div>
    <div className="eyebrow"><span className="dot" />{eyebrow}</div>
    <h1 style={{ marginTop: 12 }}>{title}</h1>{sub && <p>{sub}</p>}</div>{action}</div></div>;
}

export function Field({ label, hint, ...input }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  return <div className="field"><label htmlFor={id}>{label}</label><input id={id} className="inp" {...input} />
    {hint && <div className="hint">{hint}</div>}</div>;
}

export function Modal({ title, onClose, children }: { title: ReactNode; onClose(): void; children: ReactNode }) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);
  return <div className="modal-wrap" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="modal" role="dialog" aria-modal="true"><div className="am-headrow" style={{ marginBottom: 16 }}>
      <h2>{title}</h2><button type="button" className="chipbtn" onClick={onClose}>Close</button></div>{children}</div></div>;
}

export function useFetch<T>(path: string | null) {
  const [state, setState] = useState<{ data: T | null; error: string; loading: boolean }>({ data: null, error: '', loading: !!path });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    let active = true;
    api<T>(path, 'GET', undefined, true).then(
      data => { if (active) setState({ data, error: '', loading: false }); },
      error => { if (active) setState({ data: null, loading: false, error: error instanceof Error ? error.message : 'Could not load.' }); });
    return () => { active = false; };
  }, [path, tick]);
  return { ...state, reload: useCallback(() => setTick(value => value + 1), []) };
}

/** Runs an async action from a form submit and keeps busy and error state for the buttons and message. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = useCallback(async (action: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await action(); return true; }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Please try again.'); return false; }
    finally { setBusy(false); }
  }, []);
  const submit = useCallback((action: (form: FormData) => Promise<unknown>) => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    void run(() => action(new FormData(form)));
  }, [run]);
  return { busy, error, run, submit, setError };
}

export const Loading = () => <p className="am-note" role="status">Loading…</p>;
export const ErrorNote = ({ message }: { message: string }) => <p className="am-error" role="alert">{message}</p>;
export const form = (data: FormData, key: string) => String(data.get(key) ?? '').trim();
