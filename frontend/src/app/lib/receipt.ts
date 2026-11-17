const esc = (value: string) => value.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] ?? ch);
const rupees = (amount: number) => '₹' + amount.toLocaleString('en-IN');
const day = (value: string) => new Date(value).toLocaleDateString('en-IN', { dateStyle: 'medium' });

export type Receipt = {
  member: string; household: string; mahallu: string; programme: string; animal: string; shares: number;
  total: number; paid: number; remaining: number;
  payments: { id: string; amount: number; method: 'CASH' | 'ONLINE'; createdAt: string; note: string | null }[];
};

/** Saves a printable receipt as an HTML file. Open it and print to PDF if a PDF is needed. */
export function downloadReceipt(receipt: Receipt) {
  const rows = receipt.payments.map(item => `<tr><td>${esc(day(item.createdAt))}</td><td>${esc(item.id.slice(0, 8).toUpperCase())}</td>
    <td>${item.method === 'CASH' ? 'Cash' : 'Online'}${item.note ? ' · ' + esc(item.note) : ''}</td><td class="r">${esc(rupees(item.amount))}</td></tr>`).join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Payment receipt</title><style>
    body{font:15px/1.5 system-ui,sans-serif;color:#12161d;max-width:680px;margin:32px auto;padding:0 20px}h1{margin:0 0 4px;font-size:26px}
    .muted{color:#5f706a}.box{border:1px solid #dce8e0;border-radius:14px;padding:16px 18px;margin:18px 0}table{width:100%;border-collapse:collapse}
    th,td{text-align:left;padding:9px 6px;border-bottom:1px solid #eef2ef}th{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#5f706a}.r{text-align:right}
    .total td{font-weight:700;border-bottom:0}@media print{body{margin:0}}</style></head><body>
    <h1>Udhiyya Saver</h1><div class="muted">Payment receipt · ${esc(day(new Date().toISOString()))}</div>
    <div class="box"><b>${esc(receipt.programme)}</b><br>${esc(receipt.animal)} · ${receipt.shares} ${receipt.shares === 1 ? 'share' : 'shares'}<br>
    <span class="muted">${esc(receipt.household)} · ${esc(receipt.mahallu)}<br>Paid by ${esc(receipt.member)}</span></div>
    <table><thead><tr><th>Date</th><th>Reference</th><th>Method</th><th class="r">Amount</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="muted">No confirmed payments yet.</td></tr>'}</tbody>
    <tfoot><tr class="total"><td colspan="3">Total paid</td><td class="r">${esc(rupees(receipt.paid))}</td></tr>
    <tr><td colspan="3" class="muted">Total for the booking</td><td class="r muted">${esc(rupees(receipt.total))}</td></tr>
    <tr><td colspan="3" class="muted">Remaining</td><td class="r muted">${esc(rupees(receipt.remaining))}</td></tr></tfoot></table>
    <p class="muted">Held by your mahallu committee. Keep this receipt for your records.</p></body></html>`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  link.download = `udhiyya-receipt-${new Date().toISOString().slice(0, 10)}.html`;
  link.click();
  URL.revokeObjectURL(link.href);
}
