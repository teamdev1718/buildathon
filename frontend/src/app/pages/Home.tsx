import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/auth';
import { greeting, useApp } from '../lib/app-context';
import { ErrorNote, Loading, useFetch } from '../ui/kit';

type Mahallu = { id: string; active: boolean; households: number };
type Households = { total: number; linked: number; people: number };

function Stat({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return <div className="stat am-reveal" role="listitem"><div className="eyebrow">{label}</div><div className="v">{value}</div><div className="s">{sub}</div></div>;
}

function SuperStats() {
  const { data, error, loading } = useFetch<Mahallu[]>('/mahallus');
  if (loading) return <Loading />;
  if (!data) return <ErrorNote message={error} />;
  return <div className="stat-grid" role="list" aria-label="Overview">
    <Stat label="Mahallus" value={data.length} sub={`${data.filter(item => item.active).length} active`} />
    <Stat label="Households" value={data.reduce((sum, item) => sum + item.households, 0)} sub="across all mahallus" />
    <Stat label="Programs" value="—" sub="arrive in the next release" />
    <Stat label="Payments" value="—" sub="arrive in the next release" />
  </div>;
}

function AdminStats({ mahalluId }: { mahalluId: string }) {
  const { data, error, loading } = useFetch<Households>(`/mahallus/${mahalluId}/households`);
  if (loading) return <Loading />;
  if (!data) return <ErrorNote message={error} />;
  return <div className="stat-grid" role="list" aria-label="Overview">
    <Stat label="Households" value={data.total} sub="registered members" />
    <Stat label="People" value={data.people} sub="across all houses" />
    <Stat label="Signed up" value={data.linked} sub={`${data.total - data.linked} not yet linked`} />
    <Stat label="Programs" value="—" sub="arrive in the next release" />
  </div>;
}

export function Home() {
  const { user } = useAuth();
  const { ctx, isSuper, activeMahallu } = useApp();
  if (!user) return null;
  const house = ctx?.households[0];
  const first = user.name.split(' ')[0];
  const place = activeMahallu?.mahalluName ?? house?.mahalluName;
  return <div className="stack">
    <section className="hero-panel" aria-label="Welcome">
      <span className="tag live"><i />{isSuper ? 'Super admin' : activeMahallu ? 'Mahallu admin' : house ? 'Verified member' : 'Welcome'}{place ? ' · ' + place : ''}</span>
      <h1 style={{ marginTop: 16 }}>{greeting()}, {first}<span className="serif">.</span></h1>
      <p className="sub">{isSuper ? 'Create mahallus and give their committees access.' :
        activeMahallu ? 'Manage your members and, soon, your Udhiyya programs.' :
          house ? 'You are linked to your mahallu. Programs will appear here as soon as your committee opens one.' :
            'Link your household to your mahallu to join its Udhiyya programs.'}</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 22, position: 'relative', zIndex: 1 }}>
        {isSuper && <Link className="pillbtn light" to="/app/mahallus">Manage mahallus</Link>}
        {activeMahallu && <Link className="pillbtn light" to="/app/members">Manage members</Link>}
        {!house && !isSuper && !activeMahallu && <Link className="pillbtn light" to="/app/join">Link my household</Link>}
        {house && <Link className="pillbtn light" to="/app/join">My mahallu</Link>}
      </div>
    </section>
    {isSuper ? <SuperStats /> : activeMahallu ? <AdminStats mahalluId={activeMahallu.mahalluId} /> : house ?
      <div className="stat-grid" role="list" aria-label="Your household">
        <Stat label="Mahallu" value={house.mahalluName} sub="your community" />
        <Stat label="Mahallu number" value={house.mahalluNumber} sub="your membership" />
        <Stat label="Family members" value={house.memberCount} sub={house.ownerName} />
        <Stat label="Programs" value="—" sub="none open yet" />
      </div> : null}
  </div>;
}
