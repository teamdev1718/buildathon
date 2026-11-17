import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { startHarness } from './harness.js';

const { db, call, makeUser, stop, prefix } = await startHarness();
const code = 'T' + prefix.toUpperCase();
after(() => stop(() => db.mahallu.deleteMany({ where: { code: { startsWith: 'T' + prefix.toUpperCase() } } }).then(() => {})));

test('super admin creates mahallus and gives access; mahallu admins manage only their own households', async () => {
  const superAdmin = await makeUser('super', ['ADMIN']);
  const owner = await makeUser('owner');
  const other = await makeUser('other');
  const member = await makeUser('member');

  // Only the super admin manages mahallus.
  const body = { name: 'Kannur Mahallu', district: 'Kannur', code };
  assert.equal((await call(owner, 'post', '/mahallus', body)).status, 403);
  assert.equal((await call(undefined, 'get', '/mahallus')).status, 401);
  const first = await call(superAdmin, 'post', '/mahallus', body);
  assert.equal(first.status, 201);
  assert.equal((await call(superAdmin, 'post', '/mahallus', body)).status, 409);
  const second = (await call(superAdmin, 'post', '/mahallus', { ...body, name: 'Other', code: code + '2' })).body;
  const id = first.body.id as string;

  // Access: assigned by email, revocable.
  assert.equal((await call(owner, 'get', `/mahallus/${id}/households`)).status, 403);
  assert.equal((await call(superAdmin, 'post', `/mahallus/${id}/admins`, { email: owner.email, enabled: true })).status, 200);
  assert.equal((await call(superAdmin, 'post', `/mahallus/${id}/admins`, { email: 'nobody@example.com', enabled: true })).status, 404);
  assert.equal((await call(owner, 'get', `/mahallus/${id}/households`)).status, 200);
  assert.equal((await call(owner, 'get', `/mahallus/${second.id}/households`)).status, 403);
  assert.equal((await call(owner, 'get', '/me/context')).body.staff[0].role, 'MAHALLU_ADMIN');

  // Households: add, duplicate, validation.
  const house = { mahalluNumber: 'A-101', ownerName: 'Abdul Rahman', memberCount: 5, address: '12 Beach Road', phone: '+91 98765 43210' };
  const added = await call(owner, 'post', `/mahallus/${id}/households`, house);
  assert.equal(added.status, 201);
  assert.equal(added.body.phone, '9876543210');
  assert.equal((await call(owner, 'post', `/mahallus/${id}/households`, house)).status, 409);
  assert.equal((await call(owner, 'post', `/mahallus/${id}/households`, { ...house, mahalluNumber: 'A-102', phone: '123' })).status, 400);

  // Import: valid rows saved, existing numbers updated, bad rows reported.
  const imported = await call(owner, 'post', `/mahallus/${id}/households/import`, { rows: [
    { ...house, memberCount: '6' },
    { mahalluNumber: 'A-102', ownerName: 'Fathima', memberCount: '3', address: 'Market Road', phone: '9446012345' },
    { mahalluNumber: 'A-103', ownerName: '', memberCount: '2', address: 'x', phone: '9446012346' },
    { mahalluNumber: 'A-102', ownerName: 'Dup', memberCount: '2', address: 'x', phone: '9446012347' },
  ] });
  assert.equal(imported.status, 200);
  assert.deepEqual([imported.body.created, imported.body.updated, imported.body.errors.length], [1, 1, 2]);
  const list = (await call(owner, 'get', `/mahallus/${id}/households`)).body;
  assert.equal(list.total, 2);
  assert.equal(list.rows.find((row: { mahalluNumber: string }) => row.mahalluNumber === 'A-101').memberCount, 6);
  assert.equal((await call(owner, 'get', `/mahallus/${id}/households?q=fathima`)).body.rows.length, 1);

  // Editing and deleting are scoped by the household's own mahallu.
  const houseId = added.body.id as string;
  assert.equal((await call(other, 'patch', `/households/${houseId}`, { ownerName: 'Hacked' })).status, 403);
  assert.equal((await call(owner, 'patch', `/households/${houseId}`, { ownerName: 'Abdul R' })).status, 200);

  // Members link with number and phone; wrong details never say which part was wrong.
  const link = { mahalluId: id, mahalluNumber: 'A-101', phone: '98765 43210' };
  assert.equal((await call(member, 'post', '/me/households/link', { ...link, phone: '9876543211' })).status, 404);
  assert.equal((await call(member, 'post', '/me/households/link', { ...link, mahalluNumber: 'Z-1' })).status, 404);
  assert.equal((await call(member, 'post', '/me/households/link', link)).status, 200);
  assert.equal((await call(other, 'post', '/me/households/link', link)).status, 404);
  const context = (await call(member, 'get', '/me/context')).body;
  assert.equal(context.households[0].mahalluName, 'Kannur Mahallu');
  assert.equal((await call(owner, 'get', `/mahallus/${id}/households`)).body.linked, 1);
  assert.equal((await call(member, 'get', '/mahallus/directory')).body.some((m: { id: string }) => m.id === id), true);

  // Revoked admins lose access; deactivated mahallus cannot be joined.
  assert.equal((await call(superAdmin, 'post', `/mahallus/${id}/admins`, { email: owner.email, enabled: false })).status, 200);
  assert.equal((await call(owner, 'get', `/mahallus/${id}/households`)).status, 403);
  assert.equal((await call(owner, 'delete', `/households/${houseId}`)).status, 403);
  assert.equal((await call(superAdmin, 'patch', `/mahallus/${id}`, { active: false })).status, 200);
  assert.equal((await call(other, 'post', '/me/households/link',
    { mahalluId: id, mahalluNumber: 'A-102', phone: '9446012345' })).status, 404);
  assert.equal((await call(superAdmin, 'delete', `/households/${houseId}`)).status, 200);
});
