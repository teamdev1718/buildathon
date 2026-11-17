import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/auth';
import { AuthPage } from './pages/auth';
import { Landing } from './pages/landing';
import { AuthLayout } from './app/AuthLayout';
import { PublicLayout } from './app/PublicLayout';
import { TransparencyIndex, TransparencyLedger } from './app/pages/Transparency';
import { Tracking } from './app/pages/Tracking';
import { Notifications } from './app/pages/Notifications';
import { ManageLedger } from './app/pages/ManageLedger';
import { AppRoot, Require, WelcomeRoot } from './app/guards';
import { Home as AppHome } from './app/pages/Home';
import { Mahallus } from './app/pages/Mahallus';
import { Members } from './app/pages/Members';
import { ManagePrograms } from './app/pages/ManagePrograms';
import { ManageProgram } from './app/pages/ManageProgram';
import { Profile as AppProfile } from './app/pages/Profile';
import { Payments } from './app/pages/Payments';
import { Volunteers } from './app/pages/Volunteers';
import { VolunteerAnimals } from './app/pages/VolunteerAnimals';
import { VolunteerDistribute } from './app/pages/VolunteerDistribute';
import { VolunteerLogin } from './app/pages/VolunteerLogin';
import './styles.css';

function Protected() {
  const { user, loading, unavailable } = useAuth();
  if (loading) return <p role="status">Checking your session…</p>;
  if (unavailable) return <div className="panel"><h1>Session unavailable</h1>
    <button onClick={() => window.location.reload()}>Try again</button></div>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

createRoot(document.getElementById('root')!).render(
  <BrowserRouter><AuthProvider><Routes>
    <Route index element={<Landing />} />
    <Route element={<AuthLayout />}>
      <Route path="login" element={<AuthPage key="login" mode="login" />} />
      <Route path="register" element={<AuthPage key="register" mode="register" />} />
      <Route path="verify-email" element={<AuthPage key="verify" mode="verify" />} />
      <Route path="forgot-password" element={<AuthPage key="forgot" mode="forgot" />} />
      <Route path="reset-password" element={<AuthPage key="reset" mode="reset" />} />
      <Route path="volunteer-login" element={<VolunteerLogin />} />
    </Route>
    <Route element={<PublicLayout />}>
      <Route path="transparency" element={<TransparencyIndex />} />
      <Route path="transparency/:id" element={<TransparencyLedger />} />
    </Route>
    <Route element={<Protected />}>
      <Route path="app/welcome" element={<WelcomeRoot />} />
      <Route path="app" element={<AppRoot />}>
        <Route index element={<AppHome />} />
        <Route element={<Require allow="super" />}><Route path="mahallus" element={<Mahallus />} /></Route>
        <Route element={<Require allow="admin" />}><Route path="members" element={<Members />} />
          <Route path="volunteers" element={<Volunteers />} />
          <Route path="manage/ledger" element={<ManageLedger />} />
          <Route path="manage/programs" element={<ManagePrograms />} /><Route path="manage/programs/:id" element={<ManageProgram />} /></Route>
        <Route element={<Require allow="status" />}><Route path="volunteer/animals" element={<VolunteerAnimals />} /></Route>
        <Route element={<Require allow="distribute" />}><Route path="volunteer/distribute" element={<VolunteerDistribute />} /></Route>
        <Route path="programs" element={<Navigate to="/app" replace />} />
        <Route path="profile" element={<AppProfile />} />
        <Route path="payments" element={<Payments />} />
        <Route path="tracking" element={<Tracking />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="join" element={<Navigate to="/app/profile" replace />} />
      </Route>
    </Route>
    <Route path="dashboard" element={<Navigate to="/app" replace />} />
    <Route path="profile" element={<Navigate to="/app/profile" replace />} />
    <Route path="*" element={<section className="panel" style={{ margin: '4rem auto' }}><h1>Page not found</h1><Link to="/">Go home</Link></section>} />
  </Routes></AuthProvider></BrowserRouter>,
);
