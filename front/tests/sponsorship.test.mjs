import test from 'node:test';
import assert from 'node:assert/strict';
import { profileFields, requestFields, httpsUrl, isLive, canReview } from '../lib/sponsorship-domain.ts';

const offer = { alias: 'Creator_1', display_name: 'Creator', bio: '', website: '', price_cents: 2500, duration_days: 7, accepting: true };

test('offer validation preserves exact cents and normalizes alias', () => {
  assert.deepEqual(profileFields(offer), { ...offer, alias: 'creator_1' });
  for (const price_cents of [0, -1, 100.5, Infinity, 1000001]) {
    assert.throws(() => profileFields({ ...offer, price_cents }));
  }
  assert.throws(() => profileFields({ ...offer, duration_days: 8 }));
  assert.throws(() => profileFields({ ...offer, alias: '../profile' }));
});

test('ad destination rejects executable URLs, non-HTTPS and credentials', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hello', 'http://brand.test', 'https://user:pass@brand.test', '//brand.test']) {
    assert.throws(() => httpsUrl(url));
  }
  assert.equal(httpsUrl('https://brand.test'), 'https://brand.test/');
  assert.throws(() => requestFields({ brand_name: 'Brand', headline: 'Hi', description: '', destination_url: 'https://brand.test' }));
});

test('only an approved paid time window displays as active', () => {
  const campaign = { status: 'active', starts_at: '2026-10-01T00:00:00Z', ends_at: '2026-10-08T00:00:00Z' };
  assert.equal(isLive(campaign, Date.parse('2026-10-01T00:00:00Z')), true);
  assert.equal(isLive(campaign, Date.parse('2026-10-08T00:00:00Z')), false);
  assert.equal(isLive(campaign, Date.parse('2026-09-30T00:00:00Z')), false);
  assert.equal(isLive({ ...campaign, status: 'approved' }, Date.parse('2026-10-02T00:00:00Z')), false);
  assert.equal(isLive({ ...campaign, ends_at: 'invalid' }), false);
});

test('review is limited to the creator and pending requests', () => {
  assert.equal(canReview({ status: 'pending', creator_wallet: 'owner' }, 'owner'), true);
  assert.equal(canReview({ status: 'pending', creator_wallet: 'owner' }, 'brand'), false);
  assert.equal(canReview({ status: 'active', creator_wallet: 'owner' }, 'owner'), false);
});
