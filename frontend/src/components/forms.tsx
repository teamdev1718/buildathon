import { useState, type FormEvent, type ReactNode, type InputHTMLAttributes } from 'react';

export function Field({ label, ...input }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="field"><span>{label}</span><input required {...input} /></label>;
}

export function AsyncForm({ children, action, submit }: {
  children?: ReactNode;
  action(form: FormData): Promise<string | void>;
  submit: string;
}) {
  const [state, setState] = useState({ busy: false, error: '', success: '' });
  async function handle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState({ busy: true, error: '', success: '' });
    try {
      setState({ busy: false, error: '', success: await action(form) ?? '' });
    } catch (error) {
      setState({ busy: false, success: '', error: error instanceof Error ? error.message : 'Please try again.' });
    }
  }
  return <form onSubmit={handle} className="stack">
    <fieldset disabled={state.busy} className="stack">{children}
      <button type="submit">{state.busy ? 'Working…' : submit}</button>
    </fieldset>
    {state.error && <p className="notice error" role="alert">{state.error}</p>}
    {state.success && <p className="notice toast" role="status">{state.success}</p>}
  </form>;
}

export const value = (form: FormData, key: string) => String(form.get(key) ?? '');

