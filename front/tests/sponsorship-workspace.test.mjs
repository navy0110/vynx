import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignState, nextCampaignAction } from '../lib/sponsorship-workspace.ts';

const campaign = {
  creator_wallet: 'creator', brand_wallet: 'brand', status: 'active',
  starts_at: '2026-10-01T00:00:00Z', ends_at: '2026-10-08T00:00:00Z',
};
test('campaign leaves the active filter at the exact expiry time', () => {
  assert.equal(campaignState(campaign, Date.parse('2026-10-07T23:59:59Z')), 'active');
  assert.equal(campaignState(campaign, Date.parse(campaign.ends_at)), 'ended');
  for (const status of ['pending', 'approved', 'rejected']) {
    assert.equal(campaignState({...campaign,status}, Date.parse(campaign.ends_at)), status);
  }
});
test('next action distinguishes review, waiting and payment recovery', () => {
  const pending = {...campaign,status:'pending'};
  assert.match(nextCampaignAction(pending, 'creator'), /Revisa el anuncio/);
  assert.match(nextCampaignAction(pending, 'brand'), /Todavía no debes pagar/);
  const approved = {...campaign,status:'approved'};
  assert.match(nextCampaignAction(approved, 'creator'), /La marca debe pagar/);
  assert.match(nextCampaignAction(approved, 'brand'), /Paga para iniciar/);
  assert.match(nextCampaignAction(approved, 'brand', true), /sin pagar de nuevo/);
  assert.match(nextCampaignAction({...campaign,status:'rejected'}, 'brand'), /No debes realizar un pago/);
  assert.match(nextCampaignAction(campaign, 'brand', false, Date.parse(campaign.ends_at)), /terminó/);
});
