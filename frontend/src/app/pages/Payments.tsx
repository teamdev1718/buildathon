import { dateText, inr, animalLabel, type AnimalType } from '../lib/programs';
import { ErrorNote, Loading, PageHead, useFetch } from '../ui/kit';

type Row = { id: string; amount: number; method: 'CASH' | 'ONLINE'; status: 'PENDING' | 'CONFIRMED' | 'REJECTED'; note: string | null;
  createdAt: string; programName: string; animalType: AnimalType };
const statusText = { PENDING: 'Pending', CONFIRMED: 'Confirmed', REJECTED: 'Not completed' } as const;

export function Payments() {
  const { data, error, loading } = useFetch<Row[]>('/me/payments');
  const paid = data?.filter(row => row.status === 'CONFIRMED').reduce((sum, row) => sum + row.amount, 0) ?? 0;
  return <>
    <PageHead eyebrow="Ledger" title={<>Every rupee, <span className="serif">accounted.</span></>}
      sub="All your payments to your mahallu committee. Pending payments only count once they are confirmed." />
    {loading && !data ? <Loading /> : !data ? <ErrorNote message={error} /> : data.length === 0 ?
      <div className="card empty"><h3>No payments yet</h3><p>Payments you make for your Udhiyya bookings will be listed here.</p></div> :
      <section className="card"><div className="kv" style={{ marginBottom: 12 }}><span>Total paid</span><b>{inr(paid)}</b></div>
        <div className="tx-wrap"><table className="tx"><thead><tr><th>Date</th><th>Payment</th><th>Method</th><th>Status</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
          <tbody>{data.map(row => <tr key={row.id}><td>{dateText(row.createdAt)}</td>
            <td><b>{row.programName}</b><div className="am-sub">{animalLabel[row.animalType]}{row.note ? ' · ' + row.note : ''}</div></td>
            <td>{row.method === 'CASH' ? 'Cash' : 'Online'}</td>
            <td><span className={'status' + (row.status === 'PENDING' ? ' pend' : row.status === 'REJECTED' ? ' disp' : '')}>{statusText[row.status]}</span></td>
            <td className="amt" style={{ textAlign: 'right' }}>{inr(row.amount)}</td></tr>)}</tbody></table></div></section>}
  </>;
}
