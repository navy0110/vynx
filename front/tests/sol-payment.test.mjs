import test from 'node:test';
import assert from 'node:assert/strict';
import { PublicKey } from '@solana/web3.js';
import { tipLamports, verifySolPayment, MEMO_PROGRAM } from '../lib/sol-payment.ts';
import { normalizeAlias, safeDestination } from '../lib/alias.ts';

const payer = '11111111111111111111111111111111';
const recipient = 'So11111111111111111111111111111111111111112';
const memo = 'vynx:tip:creator-id';
function payment() {
  return { meta: { err: null, preBalances: [100000000,0], postBalances: [90000000,10000000] }, transaction: { message: {
    accountKeys: [{pubkey:new PublicKey(payer),signer:true},{pubkey:new PublicKey(recipient),signer:false}],
    instructions: [{program:'system',programId:new PublicKey(payer),parsed:{type:'transfer',info:{source:payer,destination:recipient,lamports:10000000}}},{programId:MEMO_PROGRAM,parsed:memo}],
  } } };
}
test('SOL amount conversion uses exact lamports and enforces the tipping range', () => {
  assert.equal(tipLamports('0.00001'),10000);
  assert.equal(tipLamports('0.100000001'),100000001);
  assert.equal(tipLamports('10'),10000000000);
  for (const amount of ['0','0.000009999','10.000000001','-1','1e-2','NaN','0.0000000001',' 0.1',0.1,null]) assert.throws(() => tipLamports(amount));
});
test('SOL confirmation binds signer, operation, amount, recipient and actual receipt', () => {
  assert.doesNotThrow(() => verifySolPayment(payment(),payer,recipient,10000000,memo));
  assert.throws(() => verifySolPayment(null,payer,recipient,10000000,memo));
  for (const mutate of [
    tx => {tx.meta.err='failed';},
    tx => {tx.transaction.message.accountKeys[0].signer=false;},
    tx => {tx.transaction.message.instructions[0].parsed.info.source=recipient;},
    tx => {tx.transaction.message.instructions[0].parsed.info.destination=payer;},
    tx => {tx.transaction.message.instructions[0].parsed.info.lamports=10000001;},
    tx => {tx.transaction.message.instructions[1].parsed='vynx:claim:another-alias';},
    tx => {tx.meta.postBalances[1]=1;},
    tx => {tx.transaction.message.instructions.push(tx.transaction.message.instructions[0]);},
  ]) {const tx=payment();mutate(tx);assert.throws(() => verifySolPayment(tx,payer,recipient,10000000,memo));}
  assert.throws(() => verifySolPayment(payment(),payer,payer,10000000,memo));
});
test('creator aliases normalize consistently and cannot collide with application routes', () => {
  assert.equal(normalizeAlias(' @Alice_1 '),'alice_1');
  assert.equal(normalizeAlias('a'), 'a');
  assert.equal(normalizeAlias('aa'), 'aa');
  for (const alias of ['','a'.repeat(31),'api','dashboard','auth','../alice','a-b',null]) assert.throws(() => normalizeAlias(alias));
});
test('sign-in destinations cannot redirect to an external website', () => {
  assert.equal(safeDestination('/dashboard/card?tab=links'),'/dashboard/card?tab=links');
  for (const url of ['//attacker.example','https://attacker.example','/\\attacker.example','/\t/attacker.example','/\n/attacker.example',null]) assert.equal(safeDestination(url),'/dashboard');
});
