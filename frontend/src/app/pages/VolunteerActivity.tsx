import { IconPackage } from '../ui/Icons';
import { IconEdit } from '../ui/icons3';
import { ErrorNote, Loading, PageHead, useFetch } from '../ui/kit';

type Entry = { id: string; type: 'ANIMAL' | 'HANDOVER'; title: string; detail: string; at: string };

export function VolunteerActivity() {
  const { data, error, loading } = useFetch<Entry[]>('/volunteer/activity');
  return <>
    <PageHead eyebrow="Volunteer" title={<>My <span className="serif">activity</span></>} sub="Your recent animal updates and meat handovers." />
    {loading && !data ? <Loading /> : !data ? <ErrorNote message={error} /> : data.length === 0 ?
      <div className="card empty"><h3>Nothing yet</h3><p>Animals you update and meat you hand out will be listed here.</p></div> :
      <section className="card">{data.map(item => <div key={item.type + item.id} className="am-update">
        <span className="am-tile sm">{item.type === 'ANIMAL' ? <IconEdit /> : <IconPackage />}</span>
        <div><b>{item.title}</b><span>{item.type === 'HANDOVER' ? `House ${item.detail}` : item.detail}</span></div>
        <time>{new Date(item.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</time></div>)}</section>}
  </>;
}
