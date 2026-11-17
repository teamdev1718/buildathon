import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as logic from '../src/modules/volunteers/volunteers.logic.js';
import * as schema from '../src/modules/volunteers/volunteers.schema.js';

test('generated passwords are grouped, long enough, and avoid look-alike characters', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const password = logic.generatePassword();
    assert.match(password, /^[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}$/);
    seen.add(password);
  }
  assert.equal(seen.size, 200);
  assert.equal(logic.generatePassword(() => 0), 'AAAA-AAAA-AAAA');
});

test('usernames carry the mahallu code, a clean name and a number', () => {
  assert.equal(logic.generateUsername('KNR-01', 'Abdul Rahman K.', () => 1234), 'knr01-abdulrahmank-2234');
  assert.equal(logic.generateUsername('KNR-01', '!!!', () => 0), 'knr01-volunteer-1000');
  assert.equal(logic.volunteerEmail('knr01-ali-1234'), 'knr01-ali-1234@volunteer.invalid');
});

test('volunteers advance an animal one step at a time', () => {
  assert.equal(logic.isNextStatus('PENDING', 'SLAUGHTERED'), true);
  assert.equal(logic.isNextStatus('SLAUGHTERED', 'PROCESSING'), true);
  assert.equal(logic.isNextStatus('PROCESSING', 'PACKED'), true);
  assert.equal(logic.isNextStatus('PENDING', 'PROCESSING'), false);
  assert.equal(logic.isNextStatus('PACKED', 'PROCESSING'), false);
  assert.equal(logic.isNextStatus('PACKED', 'PACKED'), false);
});

test('volunteer input needs a role and sensible numbers', () => {
  const base = { name: 'Ali', canStatus: true, canDistribute: false };
  assert.equal(schema.volunteerInput.safeParse(base).success, true);
  assert.equal(schema.volunteerInput.safeParse({ ...base, canStatus: false }).success, false);
  assert.equal(schema.issueInput.safeParse({ packets: 0 }).success, false);
  assert.equal(schema.issueInput.safeParse({ packets: 50, note: 'First batch' }).success, true);
  assert.equal(schema.distributeInput.safeParse({ householdId: 'nope', packets: 2 }).success, false);
  assert.equal(schema.volunteerLogin.parse({ username: ' KNR01-Ali-1234 ', password: 'x' }).username, 'knr01-ali-1234');
});
