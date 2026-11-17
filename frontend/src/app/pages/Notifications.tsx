import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useApp } from '../lib/app-context';
import { IconBell, IconClock, IconHand, IconHeart } from '../ui/Icons';
import { ErrorNote, Loading, PageHead, useAction, useFetch } from '../ui/kit';

type Item = { id: string; kind: string; title: string; body: string; link: string | null; createdAt: string; readAt: string | null };
type Inbox = { unread: number; items: Item[] };

const icon = (kind: string) => kind === 'animal.next' ? <IconClock /> : kind === 'meat.given' ? <IconHand /> : kind === 'animal.status' ? <IconHeart /> : <IconBell />;
const ago = (value: string) => {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} h ago`;
  return new Date(value).toLocaleDateString('en-IN', { dateStyle: 'medium' });
};

export function Notifications() {
  const { data, error, loading, reload } = useFetch<Inbox>('/me/inbox');
  const { refreshInbox } = useApp();
  const { busy, run } = useAction();
  useEffect(() => { const timer = setInterval(reload, 30_000); return () => clearInterval(timer); }, [reload]);
  const markAll = () => run(async () => { await api('/me/inbox/read', 'POST', {}, true); reload(); await refreshInbox(); });
  return <>
    <PageHead eyebrow="Inbox" title={<>Your <span className="serif">updates</span></>}
      sub="When your animal is next, slaughtered or packed, and when meat reaches your household."
      action={data && data.unread > 0 ? <button type="button" className="pillbtn ghost" disabled={busy} onClick={() => void markAll()}>Mark all read</button> : undefined} />
    {loading && !data ? <Loading /> : !data ? <ErrorNote message={error} /> : data.items.length === 0 ?
      <div className="card empty"><h3>Nothing yet</h3><p>Updates about your animal and meat will show up here.</p></div> :
      <section className="card" style={{ padding: '8px 22px' }}>{data.items.map(item => <div key={item.id} className={'notif-row' + (item.readAt ? '' : ' unread')}>
        <span className="ic">{icon(item.kind)}</span>
        <div className="grow"><div className="t">{item.title}</div><div className="d">{item.body}</div>
          {item.link && <Link to={item.link} onClick={() => void api('/me/inbox/read', 'POST', { ids: [item.id] }, true).then(refreshInbox)}>Open</Link>}</div>
        <div className="am-sub" style={{ whiteSpace: 'nowrap' }}>{ago(item.createdAt)}</div></div>)}</section>}
  </>;
}
