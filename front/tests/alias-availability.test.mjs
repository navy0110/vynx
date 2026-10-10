import test from 'node:test';
import assert from 'node:assert/strict';
import { aliasAvailability, aliasAvailabilityClientHash } from '../lib/alias-availability.ts';

function database({ allowed = true, retryAfter = 60, limitError = null, taken = false, lookupError = null } = {}) {
  const calls = [];
  return { calls,
    async rpc(name, args) { calls.push(['limit', name, args]); return { data: { allowed, retry_after: retryAfter }, error: limitError }; },
    from(table) {
      calls.push(['lookup', table]);
      return { select(columns) {
        assert.equal(columns, 'username');
        return { eq(column, alias) {
          assert.equal(column, 'username');
          calls.push(['alias', alias]);
          return { async maybeSingle() { return { data: taken ? { username: alias } : null, error: lookupError }; } };
        } };
      } };
    },
  };
}
const request = alias => new Request(`https://vynx.test/api/aliases?alias=${encodeURIComponent(alias)}`);

test('availability normalizes aliases and returns only the alias and availability', async () => {
  for (const taken of [false, true]) {
    const db = database({ taken });
    const response = await aliasAvailability(request(' @ALICE '), db, 'test-secret', false);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { alias: 'alice', available: !taken });
    assert.equal(db.calls[0][0], 'limit');
    assert.deepEqual(db.calls.at(-1), ['alias', 'alice']);
  }
});

test('invalid, reserved and missing aliases consume quota without a profile lookup', async () => {
  for (const input of ['!', 'admin', 'bad-name', 'x'.repeat(31), '']) {
    const db = database();
    const response = await aliasAvailability(request(input), db, 'test-secret', false);
    assert.equal(response.status, 400);
    assert.equal(db.calls.length, 1);
  }
  assert.equal((await aliasAvailability(new Request('https://vynx.test/api/aliases'), database(), 'test-secret', false)).status, 400);
});

test('exhausted quota returns retry guidance without an availability lookup', async () => {
  const db = database({ allowed: false, retryAfter: 17 });
  const response = await aliasAvailability(request('alice'), db, 'test-secret', false);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '17');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(db.calls.length, 1);
});

test('database failures fail closed and do not expose database details', async () => {
  for (const settings of [{ limitError: { message: 'private database detail' } }, { lookupError: { message: 'private database detail' } }, { retryAfter: 0 }, { allowed: null }]) {
    const response = await aliasAvailability(request('alice'), database(settings), 'test-secret', false);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.doesNotMatch(await response.text(), /private database detail|available":true/);
  }
  assert.equal((await aliasAvailability(request('alice'), { rpc() { throw new Error('network failure'); } }, 'test-secret', false)).status, 503);
});

test('client identities ignore spoofed headers outside Vercel and canonicalize IPv6', () => {
  const client = ip => new Request('https://vynx.test/api/aliases', { headers: { 'x-vercel-forwarded-for': ip, 'x-forwarded-for': ip } });
  const hash = (ip, trusted = false) => aliasAvailabilityClientHash(client(ip), 'test-secret', trusted);
  assert.equal(hash('192.0.2.1'), hash('192.0.2.2'));
  assert.notEqual(hash('192.0.2.1', true), hash('192.0.2.2', true));
  assert.equal(hash('2001:db8::1', true), hash('2001:0db8:0:0:0:0:0:1', true));
  assert.equal(hash('invalid', true), hash('192.0.2.1, 192.0.2.2', true));
  assert.match(hash('192.0.2.1', true), /^[a-f0-9]{64}$/);
  assert.notEqual(hash('192.0.2.1', true), aliasAvailabilityClientHash(client('192.0.2.1'), 'rotated-secret', true));
});
