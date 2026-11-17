import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/auth';
import { greeting } from '../lib/app-context';
import { IconChevronRight, IconCheck, IconClock, IconPackage, IconUsers } from '../ui/Icons';
import { IconClipboard, IconEdit, IconGear, IconPlus } from '../ui/icons3';
import { IconAnimal, IconPulse, IconTruck } from '../ui/more-icons';
import { ErrorNote, Loading, useFetch } from '../ui/kit';
import { Skyline } from '../ui/visuals';

type Overview = {
  volunteer: { name: string; mahalluName: string; canStatus: boolean; canDistribute: boolean };
  program: { id: string; name: string; status: string } | null;
  animals: { total: number; pending: number; slaughtered: number; processing: number; packed: number };
  meat: { issued: number; distributed: number; inHand: number; programDistributed: number };
};

function Tile({ icon, value, label }: { icon: ReactNode; value: ReactNode; label: string }) {
  return <div className="card am-vtile" role="listitem"><span className="am-strip-icon">{icon}</span><div><b>{value}</b><span>{label}</span></div></div>;
}

function Task({ to, icon, title, text, badge, tone }: { to: string; icon: ReactNode; title: string; text: string; badge?: string; tone?: 'amber' }) {
  return <Link to={to} className="am-task"><span className="am-tile sm">{icon}</span>
    <span className="am-task-text"><b>{title}</b><span>{text}</span></span>
    {badge && <span className={'am-pill' + (tone ? ' ' + tone : '')}>{badge}</span>}<IconChevronRight /></Link>;
}

/** The volunteer's home: today's tasks and how the whole programme is going. */
export function VolunteerDashboard() {
  const { user } = useAuth();
  const { data, error, loading } = useFetch<Overview>('/volunteer/overview');
  if (loading && !data) return <Loading />;
  if (!data) return <ErrorNote message={error} />;
  const { volunteer, program, animals, meat } = data;
  const notPacked = animals.total - animals.packed;
  const atLeast = { slaughtered: animals.slaughtered + animals.processing + animals.packed, processing: animals.processing + animals.packed, packed: animals.packed };
  const percent = animals.total ? Math.round((atLeast.slaughtered + atLeast.processing + atLeast.packed) / (animals.total * 3) * 100) : 0;
  const stages = [
    { label: 'Slaughtered', value: `${atLeast.slaughtered} / ${animals.total}`, done: animals.total > 0 && atLeast.slaughtered === animals.total, icon: <IconCheck /> },
    { label: 'Processing', value: `${atLeast.processing} / ${animals.total}`, done: animals.total > 0 && atLeast.processing === animals.total, icon: <IconGear /> },
    { label: 'Packed', value: `${atLeast.packed} / ${animals.total}`, done: animals.total > 0 && atLeast.packed === animals.total, icon: <IconPackage /> },
    { label: 'Distributed', value: `${meat.programDistributed} ${meat.programDistributed === 1 ? 'packet' : 'packets'}`, done: false, icon: <IconTruck /> },
  ];
  const tiles = [
    ...(volunteer.canStatus ? [{ icon: <IconAnimal />, value: animals.total, label: 'Total animals' }, { icon: <IconPulse />, value: notPacked, label: 'To update' }] : []),
    ...(volunteer.canDistribute ? [{ icon: <IconPackage />, value: meat.issued, label: 'Meat packets assigned' }, { icon: <IconUsers />, value: meat.distributed, label: 'Packets distributed' }] : []),
  ];
  return <div className="stack">
    <section className="am-hero2 am-vhero" aria-label="Welcome">
      <div>
        <span className="am-herotag">VOLUNTEER · {volunteer.mahalluName.replace(/ mahallu$/i, '').toUpperCase()}</span>
        <h1>{greeting()}, {user?.name.split(' ')[0]}.</h1>
        <p>Thank you for helping with the Udhiyya programme. Here are your tasks for today.</p>
        <div className="am-herobuttons">
          {volunteer.canStatus && <Link className="pillbtn light" to="/app/volunteer/animals"><IconPlus />Update animals</Link>}
          {volunteer.canDistribute && <Link className="pillbtn outline" to="/app/volunteer/distribute"><IconPackage />Distribute meat</Link>}
        </div>
      </div>
      <Skyline />
    </section>

    <div className="am-vtiles" role="list">{tiles.map(tile => <Tile key={tile.label} {...tile} />)}</div>

    <div className="am-vgrid">
      <section className="card">
        <div className="am-cardhead"><span className="am-tile"><IconClipboard /></span><div><h2>Today’s tasks</h2><span className="am-sub">Your pending actions in the programme.</span></div></div>
        <div className="am-tasks">
          {volunteer.canStatus && <Task to="/app/volunteer/animals" icon={<IconEdit />} title="Update animal status" text="Mark animals as slaughtered, processing or packed." badge={`${notPacked} pending`} />}
          {volunteer.canDistribute && <Task to="/app/volunteer/distribute" icon={<IconTruck />} title="Distribute meat" text="Record meat packets given to households." badge={`${meat.inHand} remaining`} tone="amber" />}
          <Task to="/app/volunteer/activity" icon={<IconClock />} title="My activity" text="View your recent updates and distributions." />
        </div>
      </section>

      <section className="card">
        <div className="am-headrow" style={{ alignItems: 'center' }}>
          <div className="am-cardhead" style={{ margin: 0 }}><span className="am-tile"><IconPulse /></span>
            <div><h2>Programme progress</h2><span className="am-sub">{program ? `${program.name} · ${volunteer.mahalluName.replace(/ mahallu$/i, '')}` : 'No programme is running'}</span></div></div>
          {program && <span className="am-pill">Running</span>}
        </div>
        {program ? <>
          <ol className="am-vsteps" aria-label="Programme progress">{stages.map((stage, index) => <li key={stage.label} className={stage.done ? 'done' : ''}>
            <span className="am-node">{stage.icon}</span><b>{stage.label}</b><small>{stage.value}</small>{index < stages.length - 1 && <i aria-hidden="true" />}</li>)}</ol>
          <div className="am-bar" style={{ marginTop: 18 }}><div className="progress" role="progressbar" aria-label="Programme progress" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><i style={{ width: percent + '%' }} /></div>
            <b>{percent}% complete</b></div></> :
          <p className="am-note" style={{ marginTop: 14 }}>Progress appears here once your committee starts the programme.</p>}
      </section>
    </div>
  </div>;
}
