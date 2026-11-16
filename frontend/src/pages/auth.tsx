import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { AsyncForm, Field, value } from '../components/forms';
import { useAuth } from '../contexts/auth';

const titles = {
  login: 'Sign in', register: 'Create an account', verify: 'Verify your email',
  forgot: 'Forgot password', reset: 'Reset your password',
};
type Mode = keyof typeof titles;

export function AuthPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { accept, features } = useAuth();
  const [loginStep, setLoginStep] = useState<{ email: string; password: string }>();
  const [resendBusy, setResendBusy] = useState(false);
  const [resendStatus, setResendStatus] = useState('');
  const [address, setAddress] = useState(params.get('email') ?? '');
  const go = (route: string, email: string) => navigate(route + '?email=' + encodeURIComponent(email));

  async function submit(form: FormData) {
    const email = address;
    const password = value(form, 'password');
    const code = value(form, 'code');
    switch (mode) {
      case 'register':
        await api('/auth/register', 'POST', { email, password, name: value(form, 'name') });
        return go('/verify-email', email);
      case 'verify':
        await api('/auth/verify-email', 'POST', { email, code, password });
        return navigate('/login?verified=1');
      case 'forgot':
        await api('/auth/forgot-password', 'POST', { email });
        return go('/reset-password', email);
      case 'reset':
        await api('/auth/reset-password', 'POST', { email, code, password });
        return navigate('/login?reset=1');
      case 'login': {
        try {
          const result = loginStep
            ? await api<{ accessToken: string }>('/auth/login/verify', 'POST', { ...loginStep, code })
            : await api<{ accessToken: string } | { otpRequired: true }>('/auth/login', 'POST', { email, password });
          if ('otpRequired' in result) {
            setLoginStep({ email, password });
            return 'Check your inbox for your sign-in code.';
          }
          await accept(result.accessToken);
          navigate('/dashboard', { replace: true });
        } catch (error) {
          if (error instanceof ApiError && error.code === 'EMAIL_UNVERIFIED') return go('/verify-email', email);
          throw error;
        }
      }
    }
  }

  async function resend() {
    setResendBusy(true);
    try {
      await api('/auth/resend-verification', 'POST', { email: address });
      setResendStatus('If verification is pending, check your inbox after the one-minute resend cooldown.');
    } catch (error) {
      setResendStatus(error instanceof Error ? error.message : 'Could not request a code.');
    } finally {
      setResendBusy(false);
    }
  }

  const newPassword = mode === 'register' || mode === 'reset' || mode === 'verify';
  return <section className="panel auth-panel">
    <h1>{loginStep ? 'Enter your sign-in code' : titles[mode]}</h1>
    {params.has('verified') && <p className="notice" role="status">Email verified. You can now sign in.</p>}
    {params.has('reset') && <p className="notice" role="status">Password updated. Sign in with your new password.</p>}
    {params.has('google') && <p className="notice error" role="alert">{params.get('google') === 'account-exists'
      ? 'An account already uses this email. Sign in with your existing method.' : 'Google sign-in failed. Try again.'}</p>}
    {features && !features.email && mode !== 'login' && <p className="notice error">Email delivery is unavailable.</p>}
    {mode === 'reset' && <p>If this address can be reset, a code will arrive by email.</p>}
    <AsyncForm action={submit} submit={loginStep ? 'Verify and sign in' : mode === 'forgot' ? 'Send reset code' : titles[mode]}>
      {mode === 'register' && <Field label="Name" name="name" autoComplete="name" maxLength={100} />}
      {!loginStep && <Field label="Email address" type="email" name="email" value={address}
        onChange={event => setAddress(event.target.value)} autoComplete="email" maxLength={254} />}
      {(loginStep || mode === 'verify' || mode === 'reset') && <Field label="Six-digit code" name="code"
        inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} />}
      {(newPassword || mode === 'login' && !loginStep) && <Field
        label={mode === 'verify' ? 'Set your password (at least 12 characters)' :
          newPassword ? 'Password (at least 12 characters)' : 'Password'} name="password" type="password"
        autoComplete={newPassword ? 'new-password' : 'current-password'} minLength={newPassword ? 12 : undefined}
        maxLength={128} />}
    </AsyncForm>
    <div className="stack auth-links">
      {mode === 'verify' && <button type="button" className="secondary" disabled={!address || resendBusy}
        onClick={() => void resend()}>{resendBusy ? 'Requesting…' : 'Request another code'}</button>}
      {resendStatus && <p className="notice" role="status">{resendStatus}</p>}
      {features?.google && (mode === 'register' || mode === 'login' && !loginStep) &&
        <a className="button secondary" href="/api/v1/auth/google">Continue with Google</a>}
      {mode === 'login' && !loginStep && <>
        <Link to="/forgot-password">Forgot password?</Link>
        <Link to="/verify-email">Verify email</Link>
        <Link to="/register">Create an account</Link>
      </>}
      {loginStep && <button className="secondary" onClick={() => setLoginStep(undefined)}>Back to password</button>}
      {mode !== 'login' && <Link to="/login">Back to sign in</Link>}
    </div>
  </section>;
}

