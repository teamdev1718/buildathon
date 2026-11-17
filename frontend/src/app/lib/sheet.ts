// Reads CSV and Excel (.xlsx) files in the browser with no extra dependencies.

export type Row = Record<string, string>;

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  const input = text.replace(/^﻿/, '');
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',' || ch === '\t' || ch === ';') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

const u16 = (view: DataView, at: number) => view.getUint16(at, true);
const u32 = (view: DataView, at: number) => view.getUint32(at, true);

async function inflate(data: Uint8Array) {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzip(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let end = bytes.length - 22;
  while (end >= 0 && u32(view, end) !== 0x06054b50) end--;
  if (end < 0) throw new Error('This is not a valid Excel file.');
  const count = u16(view, end + 10);
  let at = u32(view, end + 16);
  const files = new Map<string, () => Promise<string>>();
  for (let i = 0; i < count; i++) {
    if (u32(view, at) !== 0x02014b50) break;
    const method = u16(view, at + 10), size = u32(view, at + 20);
    const nameLength = u16(view, at + 28), extraLength = u16(view, at + 30), commentLength = u16(view, at + 32);
    const local = u32(view, at + 42);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));
    const start = local + 30 + u16(view, local + 26) + u16(view, local + 28);
    files.set(name, async () => {
      const raw = bytes.subarray(start, start + size);
      return new TextDecoder().decode(method === 0 ? raw : await inflate(raw));
    });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

const columnIndex = (ref: string) => [...ref.replace(/\d/g, '')].reduce((sum, ch) => sum * 26 + ch.charCodeAt(0) - 64, 0) - 1;

async function readXlsx(buffer: ArrayBuffer): Promise<string[][]> {
  const files = await unzip(buffer);
  const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');
  const sheetName = [...files.keys()].filter(name => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort((a, b) => parseInt(a.replace(/\D/g, '')) - parseInt(b.replace(/\D/g, '')))[0];
  if (!sheetName) throw new Error('No worksheet found in this file.');
  const shared: string[] = [];
  const sharedXml = files.get('xl/sharedStrings.xml');
  if (sharedXml) {
    for (const si of Array.from(parse(await sharedXml()).getElementsByTagName('si'))) {
      shared.push(Array.from(si.getElementsByTagName('t')).map(node => node.textContent ?? '').join(''));
    }
  }
  const sheet = parse(await files.get(sheetName)!());
  const rows: string[][] = [];
  for (const rowNode of Array.from(sheet.getElementsByTagName('row'))) {
    const row: string[] = [];
    for (const cell of Array.from(rowNode.getElementsByTagName('c'))) {
      const type = cell.getAttribute('t');
      const value = cell.getElementsByTagName('v')[0]?.textContent ?? '';
      const text = type === 's' ? shared[Number(value)] ?? '' :
        type === 'inlineStr' ? Array.from(cell.getElementsByTagName('t')).map(node => node.textContent ?? '').join('') : value;
      row[columnIndex(cell.getAttribute('r') ?? 'A1')] = text;
    }
    if (row.some(value => value?.trim())) rows.push(Array.from(row, value => value ?? ''));
  }
  return rows;
}

export async function readTable(file: File): Promise<string[][]> {
  if (file.size > 5_000_000) throw new Error('That file is too large. Keep it under 5 MB.');
  if (/\.xlsx$/i.test(file.name)) return readXlsx(await file.arrayBuffer());
  if (/\.xls$/i.test(file.name)) throw new Error('Old .xls files are not supported. Save it as .xlsx or .csv.');
  return parseCsv(await file.text());
}

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const aliases: Record<string, string[]> = {
  ownerName: ['name', 'nameowner', 'owner', 'ownername', 'headofhouse', 'head', 'houseowner'],
  memberCount: ['noofmembers', 'members', 'membercount', 'numberofmembers', 'family', 'familysize', 'count'],
  address: ['address', 'place', 'location'],
  phone: ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'contact', 'whatsapp'],
  mahalluNumber: ['mahallunumber', 'mahalnumber', 'mahallano', 'mahalno', 'membershipnumber', 'houseno', 'housenumber', 'number', 'no', 'id'],
};

/** Maps spreadsheet headers to household fields, tolerating spacing, case and common alternative names. */
export function toHouseholds(table: string[][]) {
  if (table.length < 2) throw new Error('The file needs a header row and at least one member.');
  const header = table[0].map(norm);
  const column: Record<string, number> = {};
  for (const [field, names] of Object.entries(aliases)) {
    const found = header.findIndex(name => names.includes(name));
    if (found >= 0) column[field] = found;
  }
  const missing = Object.keys(aliases).filter(field => !(field in column));
  if (missing.length) {
    const labels: Record<string, string> = { ownerName: 'Name (Owner)', memberCount: 'No of members', address: 'Address',
      phone: 'Phone number', mahalluNumber: 'Mahallu number' };
    throw new Error('Missing columns: ' + missing.map(field => labels[field]).join(', ') + '.');
  }
  return table.slice(1).map(cells => Object.fromEntries(Object.entries(column)
    .map(([field, index]) => [field, (cells[index] ?? '').trim()])) as Row);
}

export const templateCsv = 'Mahallu number,Name (Owner),No of members,Address,Phone number\n' +
  'A-101,Abdul Rahman,5,"12 Beach Road, Kannur",9876543210\n';
