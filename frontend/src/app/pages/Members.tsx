import { useEffect, useState, type DragEvent } from 'react';
import { api } from '../../api/client';
import { useApp } from '../lib/app-context';
import { readTable, templateCsv, toHouseholds, type Row } from '../lib/sheet';
import { CustomSelect } from '../ui/CustomSelect';
import { IconDownload, IconSearch } from '../ui/Icons';
import { ErrorNote, Field, form, Loading, Modal, PageHead, useAction, useFetch } from '../ui/kit';

type Household = { id: string; mahalluNumber: string; ownerName: string; memberCount: number; address: string; phone: string; linked: boolean };
type List = { total: number; linked: number; people: number; rows: Household[] };
type Result = { created: number; updated: number; errors: { row: number; message: string }[] };

function Edit({ mahalluId, item, done, close }: { mahalluId: string; item: Household | null; done(): void; close(): void }) {
  const { busy, error, submit } = useAction();
  const { toast } = useApp();
  return <Modal title={item ? <>Edit <span className="serif">member</span></> : <>Add <span className="serif">member</span></>} onClose={close}>
    <form onSubmit={submit(async data => {
      const body = { mahalluNumber: form(data, 'mahalluNumber'), ownerName: form(data, 'ownerName'),
        memberCount: Number(form(data, 'memberCount')), address: form(data, 'address'), phone: form(data, 'phone') };
      if (item) await api('/households/' + item.id, 'PATCH', body, true);
      else await api(`/mahallus/${mahalluId}/households`, 'POST', body, true);
      toast(item ? 'Member updated' : 'Member added'); done(); close();
    })}>
      <Field label="Mahallu number" name="mahalluNumber" required maxLength={20} defaultValue={item?.mahalluNumber} />
      <Field label="Name (owner)" name="ownerName" required maxLength={100} defaultValue={item?.ownerName} autoComplete="off" />
      <div className="grid2">
        <Field label="Members in house" name="memberCount" type="number" min={1} max={60} required defaultValue={item?.memberCount ?? 1} />
        <Field label="Phone number" name="phone" type="tel" required defaultValue={item?.phone} />
      </div>
      <Field label="Address" name="address" required maxLength={250} defaultValue={item?.address} />
      {error && <p className="am-error" role="alert">{error}</p>}
      <button className="pillbtn" type="submit" disabled={busy}>{busy ? 'Saving…' : item ? 'Save changes' : 'Add member'}</button>
    </form>
  </Modal>;
}

function Import({ mahalluId, done, close }: { mahalluId: string; done(): void; close(): void }) {
  const { busy, error, run, setError } = useAction();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [name, setName] = useState('');
  const [over, setOver] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const { toast } = useApp();

  async function pick(file: File | undefined) {
    if (!file) return;
    setResult(null); setRows(null); setName(file.name);
    await run(async () => setRows(toHouseholds(await readTable(file))));
  }
  const drop = (event: DragEvent) => { event.preventDefault(); setOver(false); void pick(event.dataTransfer.files[0]); };
  const download = () => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([templateCsv], { type: 'text/csv' }));
    link.download = 'members-template.csv'; link.click(); URL.revokeObjectURL(link.href);
  };

  return <Modal title={<>Import <span className="serif">members</span></>} onClose={close}>
    {!result && <>
      <p className="am-note" style={{ marginBottom: 12 }}>Upload a CSV or Excel (.xlsx) file with the columns <b>Mahallu number, Name (Owner), No of members, Address, Phone number</b>.
        Existing mahallu numbers are updated.</p>
      <label className={'drop' + (over ? ' over' : '')} onDragOver={event => { event.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)} onDrop={drop}>
        <input type="file" accept=".csv,.xlsx,text/csv" onChange={event => { void pick(event.target.files?.[0]); event.target.value = ''; }} />
        <b>{name || 'Choose a file or drop it here'}</b>
        <div className="hint" style={{ marginTop: 6, color: 'var(--muted)', fontSize: 13 }}>CSV or .xlsx, up to 2,000 members, 5 MB</div>
      </label>
      <button type="button" className="chipbtn" style={{ marginTop: 12 }} onClick={download}><IconDownload />Download template</button>
      {error && <p className="am-error" role="alert">{error}</p>}
      {rows && <div style={{ marginTop: 16 }}>
        <p className="am-ok">{rows.length} rows found. Preview of the first {Math.min(5, rows.length)}:</p>
        <div className="tx-wrap"><table className="tx"><thead><tr><th>No.</th><th>Owner</th><th>Members</th><th>Phone</th></tr></thead>
          <tbody>{rows.slice(0, 5).map((row, index) => <tr key={index}><td>{row.mahalluNumber}</td><td>{row.ownerName}</td>
            <td>{row.memberCount}</td><td>{row.phone}</td></tr>)}</tbody></table></div>
        <button type="button" className="pillbtn" style={{ marginTop: 14 }} disabled={busy} onClick={() => run(async () => {
          const total: Result = { created: 0, updated: 0, errors: [] };
          for (let start = 0; start < rows.length; start += 500) {
            const part = await api<Result>(`/mahallus/${mahalluId}/households/import`, 'POST', { rows: rows.slice(start, start + 500) }, true);
            total.created += part.created; total.updated += part.updated;
            total.errors.push(...part.errors.map(item => ({ ...item, row: item.row + start })));
          }
          setResult(total); setRows(null); done();
          toast(`${total.created} added, ${total.updated} updated`);
        }).then(() => setError(''))}>{busy ? 'Importing…' : `Import ${rows.length} members`}</button>
      </div>}
    </>}
    {result && <div>
      <p className="am-ok"><b>{result.created}</b> added · <b>{result.updated}</b> updated · <b>{result.errors.length}</b> skipped</p>
      {result.errors.length > 0 && <><div className="eyebrow" style={{ margin: '14px 0 8px' }}>Rows to fix (spreadsheet row, excluding header)</div>
        <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--muted)', fontSize: 14 }}>
          {result.errors.slice(0, 20).map(item => <li key={item.row + item.message}>Row {item.row + 1}: {item.message}</li>)}</ul></>}
      <button type="button" className="pillbtn" style={{ marginTop: 16 }} onClick={close}>Done</button>
    </div>}
  </Modal>;
}

export function Members() {
  const { adminOf, activeMahallu, setActiveMahalluId, toast } = useApp();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Household | 'new' | null>(null);
  const [importing, setImporting] = useState(false);
  const { run } = useAction();
  useEffect(() => { const timer = setTimeout(() => setSearch(query.trim()), 250); return () => clearTimeout(timer); }, [query]);
  const id = activeMahallu?.mahalluId;
  const { data, error, loading, reload } = useFetch<List>(id ? `/mahallus/${id}/households?q=${encodeURIComponent(search)}` : null);
  if (!id) return <div className="card empty"><h3>No mahallu assigned</h3><p>Ask the super admin to give you access.</p></div>;

  return <>
    <PageHead eyebrow={activeMahallu?.mahalluName ?? 'Members'} title={<>Your <span className="serif">members</span></>}
      sub="Every household in your mahallu. Add them one by one or import a spreadsheet."
      action={<div className="row-actions"><button type="button" className="pillbtn ghost" onClick={() => setImporting(true)}>Import CSV / Excel</button>
        <button type="button" className="pillbtn" onClick={() => setEditing('new')}>Add member</button></div>} />
    <div className="stat-grid" role="list" style={{ marginBottom: 22 }}>
      <div className="stat"><div className="eyebrow">Households</div><div className="v">{data?.total ?? '—'}</div><div className="s">registered</div></div>
      <div className="stat"><div className="eyebrow">People</div><div className="v">{data?.people ?? '—'}</div><div className="s">across all houses</div></div>
      <div className="stat"><div className="eyebrow">Signed up</div><div className="v">{data?.linked ?? '—'}</div><div className="s">accounts linked</div></div>
      <div className="stat"><div className="eyebrow">Waiting</div><div className="v">{data ? data.total - data.linked : '—'}</div><div className="s">not yet linked</div></div>
    </div>
    <section className="card">
      <div className="toolbar">
        {adminOf.length > 1 && <CustomSelect variant="mini" value={id} ariaLabel="Mahallu"
          options={adminOf.map(item => ({ value: item.mahalluId, label: item.mahalluName }))} onChange={setActiveMahalluId} />}
        <label className="searchbox grow"><IconSearch /><input value={query} onChange={event => setQuery(event.target.value)}
          placeholder="Search name, number or phone" aria-label="Search members" style={{ border: 0, outline: 0, flex: 1, minWidth: 0, background: 'transparent' }} /></label>
      </div>
      {loading && !data ? <Loading /> : !data ? <ErrorNote message={error} /> : data.rows.length === 0 ?
        <div className="empty"><h3>{search ? 'No matches' : 'No members yet'}</h3>
          <p>{search ? 'Try a different search.' : 'Add a household or import your member list.'}</p></div> :
        <div className="tx-wrap"><table className="tx">
          <thead><tr><th>Mahallu no.</th><th>Owner</th><th>Members</th><th>Phone</th><th>Address</th><th>Account</th><th /></tr></thead>
          <tbody>{data.rows.map(row => <tr key={row.id}>
            <td style={{ fontFamily: 'var(--font-mono)' }}>{row.mahalluNumber}</td><td><b>{row.ownerName}</b></td><td>{row.memberCount}</td>
            <td>{row.phone}</td><td style={{ maxWidth: 240 }}>{row.address}</td>
            <td><span className={'tag' + (row.linked ? '' : ' amber')}>{row.linked ? 'Linked' : 'Waiting'}</span></td>
            <td><div className="row-actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="chipbtn" onClick={() => setEditing(row)}>Edit</button>
              <button type="button" className="chipbtn" onClick={() => {
                if (!window.confirm(`Remove ${row.ownerName} (${row.mahalluNumber})?`)) return;
                void run(async () => { await api('/households/' + row.id, 'DELETE', {}, true); toast('Member removed'); reload(); });
              }}>Remove</button></div></td></tr>)}</tbody></table></div>}
      {data && data.total > data.rows.length && !search && <p className="am-note">Showing the first {data.rows.length} of {data.total}. Use search to find others.</p>}
    </section>
    {editing && <Edit mahalluId={id} item={editing === 'new' ? null : editing} done={reload} close={() => setEditing(null)} />}
    {importing && <Import mahalluId={id} done={reload} close={() => setImporting(false)} />}
  </>;
}
