import assert from 'node:assert/strict';
import { sign } from 'node:crypto';
import nextEnv from '@next/env';
import { Keypair } from '@solana/web3.js';
import { createClient } from '@supabase/supabase-js';

nextEnv.loadEnvConfig(process.cwd());
assert.equal(process.env.VYNX_ALIAS_REGISTRY_ENABLED, 'false', 'This script seeds legacy database-only claims. Use test:e2e:registry to test on-chain ownership; do not run legacy fixtures against an active registry environment.');
const base = process.env.TEST_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
const origin = new URL(process.env.NEXT_PUBLIC_APP_URL).origin;
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const schema = await db.from('wallet_sessions').select('token_hash').limit(0);
assert.equal(schema.error, null, 'Apply migration 004 before running this integration test.');
const creator = Keypair.generate();
const brand = Keypair.generate();
const wallet = creator.publicKey.toBase58();
const alias = `test_${Date.now()}`;
const sessions = new Map();
function signMessage(key, message) {
  return sign(null, Buffer.from(message), {key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.from(key.secretKey.slice(0,32))]),format:'der',type:'pkcs8'}).toString('hex');
}
async function authenticate(key) {
  const address = key.publicKey.toBase58();
  if (sessions.has(address)) return;
  const issue = await fetch(`${base}/api/auth/nonce`, {method:'POST',headers:{'Content-Type':'application/json',origin},body:JSON.stringify({wallet:address})});
  assert.equal(issue.status,200,await issue.clone().text());
  const nonce = await issue.json();
  const response = await fetch(`${base}/api/auth/session`, {method:'POST',headers:{'Content-Type':'application/json',origin,cookie:issue.headers.getSetCookie()[0].split(';')[0]},body:JSON.stringify({wallet:address,id:nonce.id,signature:signMessage(key,nonce.message)})});
  assert.equal(response.status,200,await response.clone().text());
  sessions.set(address,response.headers.getSetCookie().find(cookie=>cookie.startsWith('vynx-session=')).split(';')[0]);
}
async function post(body, expectedStatus = 200) {
  const response = await fetch(`${base}/api/sponsorships`, {method:'POST',headers:{'Content-Type':'application/json',origin,cookie:sessions.get(body.wallet)??''},body:JSON.stringify(body)});
  const result = await response.json();
  assert.equal(response.status,expectedStatus,JSON.stringify(result));
  return result;
}
async function signed(key, action, payload = {}, expectedStatus = 200) {
  await authenticate(key);
  const address = key.publicKey.toBase58();
  const challenge = await post({phase:'challenge',wallet:address,action,payload});
  const signature = signMessage(key, challenge.message);
  return post({wallet:address,action,payload,challenge:challenge.id,signature}, expectedStatus);
}
try {
  const { error: claimError } = await db.from('cards_users').insert({ wallet_address: wallet, username: alias });
  assert.equal(claimError, null);
  await authenticate(creator);
  const page = await fetch(`${base}/dashboard`,{headers:{cookie:sessions.get(wallet)}});
  assert.equal(page.status,200);
  assert.match(await page.text(),/logo-white\.svg/);
  const claimResponse = await fetch(`${base}/api/profile?wallet=${wallet}`);
  assert.equal(claimResponse.status, 200);
  assert.equal((await claimResponse.json()).profile.username, alias);
  const otherResponse = await fetch(`${base}/api/profile?wallet=${brand.publicKey.toBase58()}`);
  assert.equal((await otherResponse.json()).profile, null);
  await signed(creator,'save-profile',{alias,display_name:'Integration creator',bio:'Test',website:'https://example.com',price_cents:500,duration_days:7,accepting:true});
  const wrongAlias = await signed(creator,'save-profile',{alias: `${alias}_other`,display_name:'Wrong alias',bio:'Test',website:'https://example.com',price_cents:500,duration_days:7,accepting:true},400);
  assert.match(wrongAlias.error, /alias comprado/);
  const foreignAlias = await signed(brand,'save-profile',{alias,display_name:'Wrong wallet',bio:'Test',website:'https://example.com',price_cents:500,duration_days:7,accepting:true},400);
  assert.match(foreignAlias.error, /otra wallet/);
  const design = {version:1,alias,name:'Published creator',bio:'Published bio',avatar:'',cover:'',accent:'mint',theme:'dark',rounded:true,links:[{id:'test',title:'Example',url:'https://example.com'}],socials:{instagram:'',youtube:'',x:''}};
  const published = await signed(creator,'save-design',design);
  assert.equal(published.profile.design.name,design.name);
  const publicResponse = await fetch(`${base}/api/sponsorships?alias=${alias}`);
  assert.equal(publicResponse.status,200);
  assert.equal((await publicResponse.json()).profile.design.name,design.name);
  await signed(brand,'request',{alias,brand_name:'Integration brand',headline:'Test campaign',description:'Test description',destination_url:'https://example.com'});
  const snapshot = await signed(creator,'list');
  assert.equal(snapshot.campaigns.length,1);
  await signed(creator,'approve',{id:snapshot.campaigns[0].id});
  assert.equal((await signed(brand,'list')).campaigns[0].status,'approved');
  console.log('PASS: dashboard logo, wallet claimed-alias lookup, signed offer save, design publication, public read, sponsor request, approval, dashboard list');
} finally {
  const cleanupErrors = [];
  for (const [table,column,value] of [['wallet_sessions','wallet',wallet],['wallet_sessions','wallet',brand.publicKey.toBase58()],['wallet_nonces','wallet',wallet],['wallet_nonces','wallet',brand.publicKey.toBase58()],['sponsor_requests','creator_wallet',wallet],['sponsor_profiles','wallet',wallet],['cards_users','wallet_address',wallet],['sponsor_challenges','wallet',wallet],['sponsor_challenges','wallet',brand.publicKey.toBase58()]]) {
    const {error} = await db.from(table).delete().eq(column,value);
    if(error) cleanupErrors.push(new Error(`Test cleanup failed: ${table}: ${error.message}`));
  }
  if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'Integration cleanup failed.');
  console.log('Temporary integration records removed.');
}
