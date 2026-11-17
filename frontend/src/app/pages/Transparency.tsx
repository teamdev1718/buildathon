import { Link, useParams } from 'react-router-dom';
import { dateText, inr, splitName } from '../lib/programs';
import { ErrorNote, Loading, PageHead, useFetch } from '../ui/kit';
import { categoryLabel } from './ManageLedger';

type Index = { id: string; name: string; status: string; targetDate: string; mahalluName: string; district: string }[];
type Ledger = {
  program: { id: string; name: string; status: string; targetDate: string; mahalluName: string; district: string };
  collected: number; payments: number; spent: number; balance: number; byCategory: { category: string; amount: number }[];
  animals: { total: number; slaughtered: number; processing: number; packed: number }; meat: { packetsHandedOut: number; householdsServed: number };
  expenses: { id: string; title: string; category: string; amount: number; spentOn: string; note: string | null; voidedAt: string | null; voidReason: string | null }[]; generatedAt: string;
};

export function TransparencyIndex() {
  const { data, error, loading } = useFetch<Index>('/public/ledgers');
  return <>
    <PageHead eyebrow="Open books" title={<>Every rupee, <span className="serif">in the open.</span></>}
      sub="Choose a mahallu program to see how much was collected, what was spent and how far the meat has reached. No personal details are shown." />
    {loading && !data ? <Loading /> : !data ? <ErrorNote message={error} /> : data.length === 0 ?
      <div className="card empty"><h3>No public ledgers yet</h3><p>A ledger appears here once a mahallu starts a program.</p></div> :
      <div className="am-card-list">{data.map(item => <Link key={item.id} to={`/transparency/${item.id}`} className="am-mahallu am-reveal am-link">
        <div className="am-headrow"><div><h3>{item.name}</h3><div className="am-sub">{item.mahalluName} · {item.district} · Udhiyya on {dateText(item.targetDate)}</div></div>
          <span className={'tag' + (item.status === 'ENDED' ? ' off' : '')}>{item.status === 'OPEN' ? 'Running' : 'Ended'}</span></div></Link>)}</div>}
  </>;
}

export function TransparencyLedger() {
  const { id = '' } = useParams();
  const { data, error, loading } = useFetch<Ledger>(`/public/ledgers/${id}`);
  if (loading && !data) return <Loading />;
  if (!data) return <><ErrorNote message={error} /><Link to="/transparency">← All ledgers</Link></>;
  const total = data.byCategory.reduce((sum, row) => sum + row.amount, 0);
  return <>
    <PageHead eyebrow={`${data.program.mahalluName} · ${data.program.district}`} title={<>{splitName(data.program.name)[0]}<span className="serif">{splitName(data.program.name)[1]}</span></>}
      sub={`Udhiyya on ${dateText(data.program.targetDate)}. Updated ${new Date(data.generatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.`} />
    <Link to="/transparency" className="am-back">← All ledgers</Link>
    <div className="stack">
      <div className="stat-grid" role="list">
        <div className="stat"><div className="eyebrow">Collected</div><div className="v">{inr(data.collected)}</div><div className="s">{data.payments} {data.payments === 1 ? 'payment' : 'payments'}</div></div>
        <div className="stat"><div className="eyebrow">Spent</div><div className="v">{inr(data.spent)}</div><div className="s">{data.expenses.filter(row => !row.voidedAt).length === 1 ? '1 expense' : `${data.expenses.filter(row => !row.voidedAt).length} expenses`}</div></div>
        <div className="stat"><div className="eyebrow">Balance</div><div className="v">{inr(data.balance)}</div><div className="s">held by the committee</div></div>
        <div className="stat"><div className="eyebrow">Meat handed out</div><div className="v">{data.meat.packetsHandedOut}</div><div className="s">{data.meat.packetsHandedOut === 1 ? 'packet' : 'packets'} to {data.meat.householdsServed} {data.meat.householdsServed === 1 ? 'household' : 'households'}</div></div></div>
      <div className="grid2" style={{ gap: 16 }}>
        <section className="card"><div className="eyebrow"><span className="dot" />ANIMALS</div>
          <h2 style={{ fontSize: 22, margin: '8px 0 14px' }}>Progress on the <span className="serif">day</span></h2>
          <div className="progress" role="progressbar" aria-label="Animals packed" aria-valuenow={data.animals.total ? Math.round(data.animals.packed / data.animals.total * 100) : 0} aria-valuemin={0} aria-valuemax={100}>
            <i style={{ width: (data.animals.total ? data.animals.packed / data.animals.total * 100 : 0) + '%' }} /></div>
          <div className="kv"><span>Total animals</span><b>{data.animals.total}</b></div><div className="kv"><span>Slaughtered</span><b>{data.animals.slaughtered}</b></div>
          <div className="kv"><span>Processing</span><b>{data.animals.processing}</b></div><div className="kv"><span>Packed</span><b>{data.animals.packed}</b></div></section>
        <section className="card"><div className="eyebrow"><span className="dot" />SPENDING</div>
          <h2 style={{ fontSize: 22, margin: '8px 0 14px' }}>By <span className="serif">category</span></h2>
          {data.byCategory.length === 0 ? <p className="am-note">No expenses recorded yet.</p> : data.byCategory.map(row => <div key={row.category} style={{ marginBottom: 12 }}>
            <div className="kv" style={{ marginBottom: 4 }}><span>{categoryLabel[row.category]}</span><b>{inr(row.amount)}</b></div>
            <div className="progress" role="img" aria-label={`${categoryLabel[row.category]} ${Math.round(row.amount / total * 100)} percent`}><i style={{ width: row.amount / total * 100 + '%' }} /></div></div>)}</section>
      </div>
      <section className="card"><div className="eyebrow"><span className="dot" />EXPENSES</div>
        <h2 style={{ fontSize: 22, margin: '8px 0 14px' }}>Every <span className="serif">expense</span></h2>
        {data.expenses.length === 0 ? <div className="empty"><h3>No expenses yet</h3></div> :
          <div className="tx-wrap"><table className="tx"><thead><tr><th>Date</th><th>Expense</th><th>Category</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
            <tbody>{data.expenses.map(row => <tr key={row.id} style={row.voidedAt ? { opacity: .55 } : undefined}><td>{dateText(row.spentOn)}</td>
              <td><b style={row.voidedAt ? { textDecoration: 'line-through' } : undefined}>{row.title}</b><div className="am-sub">{row.voidedAt ? `Voided: ${row.voidReason}` : row.note}</div></td>
              <td>{categoryLabel[row.category]}</td><td className="amt" style={{ textAlign: 'right' }}>{inr(row.amount)}</td></tr>)}</tbody></table></div>}</section>
    </div>
  </>;
}
