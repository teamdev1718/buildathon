import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { AsyncForm, Field, value } from '../../components/forms';
import { useAuth } from '../../contexts/auth';

export function VolunteerLogin() {
  const { accept } = useAuth();
  const navigate = useNavigate();
  return <section className="panel auth-panel">
    <h1>Volunteer sign in</h1>
    <p>Use the username and password your mahallu admin gave you.</p>
    <AsyncForm submit="Sign in" action={async form => {
      const result = await api<{ accessToken: string }>('/auth/volunteer-login', 'POST', { username: value(form, 'username'), password: value(form, 'password') });
      await accept(result.accessToken);
      navigate('/app', { replace: true });
    }}>
      <Field label="Username" name="username" autoComplete="username" autoCapitalize="none" maxLength={60} />
      <Field label="Password" name="password" type="password" autoComplete="current-password" maxLength={100} />
    </AsyncForm>
    <div className="stack auth-links"><Link to="/login">Member or admin? Sign in with email</Link></div>
  </section>;
}
