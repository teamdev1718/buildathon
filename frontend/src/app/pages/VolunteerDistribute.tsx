import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useApp } from '../lib/app-context';
import { IconSearch } from '../ui/Icons';
import { ErrorNote, Loading, PageHead, useAction, useFetch } from '../ui/kit';

type Stock = { issued: number; distributed: number; inHand: number; recent: { id: string; packets: number; createdAt: string; household: { mahalluNumber: string; ownerName: string } }[] };
type House = { id: string; mahalluNumber: string; ownerName: string; memberCount: number; received: number };

function Row({ house, inHand, done }: { house: House; inHand: number; done(): void }) {
  const { busy, error, run } = useAction();
  const { toast } = useApp();
  const [packets, setPackets] = useState(1);
  return <div className="am-house">
    <div className="am-headrow" style={{ alignItems: 'center' }}>
      <div><b>{house.ownerName}</b><div className="am-sub">{house.mahalluNumber} · {house.memberCount} {house.memberCount === 1 ? 'person' : 'people'}</div></div>
      <span className={'tag' + (house.received ? '' : ' amber')}>{house.received ? `Received ${house.received}` : 'Not yet'}</span></div>
    <div className="am-give">
      <div className="am-stepper" role="group" aria-label="Packets">
        <button type="button" className="iconbtn" aria-label="Fewer packets" disabled={busy || packets <= 1} onClick={() => setPackets(packets - 1)}>−</button>
        <output><b>{packets}</b><span>{packets === 1 ? 'packet' : 'packets'}</span></output>
        <button type="button" className="iconbtn" aria-label="More packets" disabled={busy || packets >= inHand} onClick={() => setPackets(packets + 1)}>+</button></div>
      <button type="button" className="pillbtn" disabled={busy || inHand < 1 || packets > inHand} onClick={() => run(async () => {
        await api('/volunteer/distribute', 'POST', { householdId: house.id, packets }, true);
        toast(`${packets} ${packets === 1 ? 'packet' : 'packets'} given to ${house.ownerName}`); setPackets(1); done();
      })}>Give</button></div>
    {error && <p className="am-error" role="alert">{error}</p>}
  </div>;
}

export function VolunteerDistribute() {
  const stock = useFetch<Stock>('/volunteer/stock');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => { const timer = setTimeout(() => setSearch(query.trim()), 250); return () => clearTimeout(timer); }, [query]);
  const houses = useFetch<House[]>('/volunteer/households?q=' + encodeURIComponent(search));
  const refresh = () => { stock.reload(); houses.reload(); };
  return <>
    <PageHead eyebrow="Volunteer" title={<>Give out <span className="serif">meat</span></>}
      sub="Find a household, choose how many packets they receive, and tap Give. Every handover is recorded." />
    {stock.loading && !stock.data ? <Loading /> : !stock.data ? <ErrorNote message={stock.error} /> : <>
      <div className="stat-grid" role="list" style={{ marginTop: 0, marginBottom: 22 }}>
        <div className="stat"><div className="eyebrow">Given to you</div><div className="v">{stock.data.issued}</div><div className="s">packets</div></div>
        <div className="stat"><div className="eyebrow">Handed out</div><div className="v">{stock.data.distributed}</div><div className="s">packets</div></div>
        <div className="stat"><div className="eyebrow">In your hands</div><div className="v">{stock.data.inHand}</div><div className="s">{stock.data.inHand === 0 ? 'ask the admin for more' : 'left to give'}</div></div></div>
      <section className="card">
        <div className="toolbar"><label className="searchbox grow"><IconSearch /><input value={query} onChange={event => setQuery(event.target.value)} aria-label="Find a household"
          placeholder="Search name, number or phone" style={{ border: 0, outline: 0, flex: 1, minWidth: 0, background: 'transparent' }} /></label></div>
        {houses.loading && !houses.data ? <Loading /> : !houses.data ? <ErrorNote message={houses.error} /> : houses.data.length === 0 ?
          <div className="empty"><h3>No households found</h3><p>Try another name or number.</p></div> :
          <div className="am-houses">{houses.data.map(house => <Row key={house.id} house={house} inHand={stock.data!.inHand} done={refresh} />)}</div>}
      </section>
      {stock.data.recent.length > 0 && <section className="card" style={{ marginTop: 22 }}>
        <h3 style={{ marginBottom: 8 }}>Your recent handovers</h3>
        {stock.data.recent.map(row => <div key={row.id} className="am-history-row"><span><b>{row.household.ownerName}</b> <span className="am-sub">{row.household.mahalluNumber} · {new Date(row.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span></span>
          <b>{row.packets} {row.packets === 1 ? 'packet' : 'packets'}</b></div>)}</section>}</>}
  </>;
}
