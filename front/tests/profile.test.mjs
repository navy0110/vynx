import test from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../app/api/profile/route.ts';

const wallet = '11111111111111111111111111111111';

test('profile lookup rejects invalid addresses and aliases', async () => {
  assert.equal((await GET(new Request('http://localhost/api/profile?wallet=invalid'))).status, 400);
  assert.equal((await GET(new Request(`http://localhost/api/profile?wallet=${wallet}&alias=bad!`))).status, 400);
});

test('profile lookup scopes the claimed alias to the current wallet without exposing private editor fields', async () => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SECRET_KEY;
  const oldFetch = globalThis.fetch;
  process.env.SUPABASE_URL = 'https://profile-test.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'test-key';
  let requested;
  const record = { username: 'alice', wallet_address: wallet };
  globalThis.fetch = async input => {
    requested = new URL(input instanceof Request ? input.url : String(input));
    return new Response(JSON.stringify([record]), { headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const response = await GET(new Request(`http://localhost/api/profile?wallet=${wallet}&alias=ALICE`));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { profile: record });
    assert.equal(requested.searchParams.get('select'), 'username,wallet_address');
    assert.equal(requested.searchParams.get('wallet_address'), `eq.${wallet}`);
    assert.equal(requested.searchParams.get('username'), 'eq.alice');
    globalThis.fetch = async () => new Response('[]', { headers: { 'Content-Type': 'application/json' } });
    assert.deepEqual(await (await GET(new Request(`http://localhost/api/profile?wallet=${wallet}`))).json(), { profile: null });
    globalThis.fetch = async () => new Response(JSON.stringify({ message: 'database unavailable' }), { status: 500 });
    assert.equal((await GET(new Request(`http://localhost/api/profile?wallet=${wallet}`))).status, 503);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldKey;
  }
});
