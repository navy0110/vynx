import { createHash } from 'node:crypto';
import { PublicKey, SystemProgram, TransactionInstruction, type AccountInfo, type Connection } from '@solana/web3.js';
import { normalizeAlias } from './alias';

export const REGISTRY_PROGRAM = new PublicKey('AxQxAgndT6ziUr3FBNafhJzF4PpniGpMX4fVRXXmh5y8');
export const registryEnabled = () => process.env.VYNX_ALIAS_REGISTRY_ENABLED !== 'false';
export const discriminator = (namespace: string, name: string) => createHash('sha256').update(`${namespace}:${name}`).digest().subarray(0, 8);
export const configPda = () => PublicKey.findProgramAddressSync([Buffer.from('config')], REGISTRY_PROGRAM)[0];
export const aliasPda = (alias: string) => PublicKey.findProgramAddressSync([Buffer.from('alias'), Buffer.from(normalizeAlias(alias))], REGISTRY_PROGRAM)[0];
export const ownerPda = (owner: PublicKey) => PublicKey.findProgramAddressSync([Buffer.from('owner'), owner.toBuffer()], REGISTRY_PROGRAM)[0];
export function accountData(info: AccountInfo<Buffer> | null, name: string, size: number) {
  if (!info || info.executable || !info.owner.equals(REGISTRY_PROGRAM) || info.data.length !== size || !info.data.subarray(0, 8).equals(discriminator('account', name))) throw new Error(`Invalid registry ${name} account.`);
  return info.data;
}
export function decodeConfig(info: AccountInfo<Buffer> | null) {
  const d = accountData(info, 'Config', 186);
  const tiers = Array.from({ length: 5 }, (_, i) => d.readBigUInt64LE(136 + i * 8));
  if (tiers.some((price, i) => price <= BigInt(0) || price > BigInt(Number.MAX_SAFE_INTEGER) || (i > 0 && price > tiers[i - 1])) || d[184] > 1 || d[185] !== PublicKey.findProgramAddressSync([Buffer.from('config')], REGISTRY_PROGRAM)[1]) throw new Error('Invalid registry pricing configuration.');
  return { sponsor: new PublicKey(d.subarray(72, 104)), treasury: new PublicKey(d.subarray(104, 136)), tiers, version: d.readBigUInt64LE(176), paused: d[184] === 1 };
}
export function decodeAlias(info: AccountInfo<Buffer> | null) {
  const d = accountData(info, 'AliasRecord', 115);
  const length = d.readUInt32LE(40);
  if (length < 1 || length > 30) throw new Error('Invalid registry alias length.');
  const alias = d.subarray(44, 44 + length).toString('utf8');
  if (normalizeAlias(alias) !== alias || d[84 + length] !== PublicKey.findProgramAddressSync([Buffer.from('alias'), Buffer.from(alias)], REGISTRY_PROGRAM)[1]) throw new Error('Invalid registry alias.');
  return { alias, owner: new PublicKey(d.subarray(8, 40)), slot: d.readBigUInt64LE(44 + length), price: d.readBigUInt64LE(52 + length), version: d.readBigUInt64LE(60 + length), intent: d.subarray(68 + length, 84 + length).toString('hex') };
}
export function verifyOwnershipAccounts(alias: string, owner: PublicKey, aliasInfo: AccountInfo<Buffer> | null, ownerInfo: AccountInfo<Buffer> | null) {
  const record = decodeAlias(aliasInfo);
  const index = accountData(ownerInfo, 'OwnerIndex', 73);
  if (record.alias !== alias || !record.owner.equals(owner) || !new PublicKey(index.subarray(8, 40)).equals(owner) || !new PublicKey(index.subarray(40, 72)).equals(aliasPda(alias)) || index[72] !== PublicKey.findProgramAddressSync([Buffer.from('owner'), owner.toBuffer()], REGISTRY_PROGRAM)[1]) throw new Error('Registry ownership PDAs do not match.');
  return record;
}
export async function readOwnership(connection: Connection, alias: string, owner: PublicKey) {
  const [record, index] = await connection.getMultipleAccountsInfo([aliasPda(alias), ownerPda(owner)], 'confirmed');
  return verifyOwnershipAccounts(alias, owner, record, index);
}
export function registerInstruction(owner: PublicKey, sponsor: PublicKey, treasury: PublicKey, alias: string, price: bigint, version: bigint, expiry: bigint, intent: Buffer) {
  if (normalizeAlias(alias) !== alias || intent.length !== 16) throw new Error('Invalid registration arguments.');
  const name = Buffer.from(alias);
  const data = Buffer.alloc(8 + 4 + name.length + 24 + 16);
  discriminator('global', 'register').copy(data);
  data.writeUInt32LE(name.length, 8); name.copy(data, 12);
  [price, version, expiry].forEach((value, i) => data.writeBigUInt64LE(value, 12 + name.length + 8 * i));
  intent.copy(data, 36 + name.length);
  const keys = [[owner, true, true], [sponsor, true, false], [configPda(), false, false], [treasury, false, true], [aliasPda(alias), false, true], [ownerPda(owner), false, true], [SystemProgram.programId, false, false]] as const;
  return new TransactionInstruction({ programId: REGISTRY_PROGRAM, data, keys: keys.map(([pubkey, isSigner, isWritable]) => ({ pubkey, isSigner, isWritable })) });
}
export const solPrice = (lamports: bigint) => `${lamports / BigInt(1_000_000_000)}.${(lamports % BigInt(1_000_000_000)).toString().padStart(9, '0')}`.replace(/\.?0+$/, '');
