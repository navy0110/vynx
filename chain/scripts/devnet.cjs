// Devnet-only administration/smoke client. It never prints wallet secret material.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const {
  Connection,
  Keypair,
  Transaction,
  ComputeBudgetProgram,
  sendAndConfirmTransaction,
  SystemProgram,
} = require("@solana/web3.js");
const client = require("./client.cjs");
const root = path.join(__dirname, "..");
const connection = new Connection(
  process.env.VYNX_DEVNET_RPC_URL || "https://api.devnet.solana.com",
  "confirmed",
);
const GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
function wallet(name) {
  const variable = `VYNX_${name.replace("devnet-", "").toUpperCase()}_KEYPAIR`;
  const file =
    process.env[variable] || path.join(root, ".wallets", `${name}.json`);
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(file, "utf8"))),
  );
}
async function send(ix, feePayer, signers) {
  const latest = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: feePayer.publicKey, ...latest }).add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }),
    ix,
  );
  const fee = await connection.getFeeForMessage(
    tx.compileMessage(),
    "confirmed",
  );
  if (fee.value === null || fee.value > 50000)
    throw Error("Sponsor network fee exceeds 50,000 lamports");
  const signature = await sendAndConfirmTransaction(
    connection,
    tx,
    [
      ...new Map(
        [feePayer, ...signers].map((k) => [k.publicKey.toBase58(), k]),
      ).values(),
    ],
    { commitment: "confirmed" },
  );
  console.log("Signature:", signature);
  return signature;
}
async function main() {
  if ((await connection.getGenesisHash()) !== GENESIS)
    throw Error("Devnet is required");
  const command = process.argv[2];
  if (command === "initialize") {
    const deployer = wallet("devnet-deployer"),
      sponsor = wallet("devnet-sponsor"),
      treasury = wallet("devnet-treasury");
    const existing = await connection.getAccountInfo(client.configPda());
    if (existing) {
      const config = client.decodeConfig(existing);
      assert(config.admin.equals(deployer.publicKey));
      assert(config.sponsor.equals(sponsor.publicKey));
      assert(config.treasury.equals(treasury.publicKey));
      console.log("Configuration already initialized and verified");
      return;
    }
    await send(
      client.initializeIx(
        deployer.publicKey,
        deployer.publicKey,
        sponsor.publicKey,
        treasury.publicKey,
      ),
      deployer,
      [],
    );
    const config = client.decodeConfig(
      await connection.getAccountInfo(client.configPda()),
    );
    assert.deepEqual(config.tiers, client.INITIAL_TIERS);
    console.log("Config:", client.configPda().toBase58());
  } else if (command === "prices") {
    const config = client.decodeConfig(
      await connection.getAccountInfo(client.configPda()),
    );
    const inputs = process.argv.slice(3);
    if (inputs.length === 0) {
      console.log({
        tiersLamports: config.tiers.map(String),
        priceVersion: String(config.priceVersion),
        admin: config.admin.toBase58(),
        sponsor: config.sponsor.toBase58(),
        treasury: config.treasury.toBase58(),
        paused: config.paused,
      });
      return;
    }
    if (inputs.length !== 5 || inputs.some((v) => !/^\d+$/.test(v)))
      throw Error("Provide exactly five integer lamport prices");
    await send(
      client.pricesIx(wallet("devnet-deployer").publicKey, inputs.map(BigInt)),
      wallet("devnet-deployer"),
      [],
    );
  } else if (command === "smoke") {
    const sponsor = wallet("devnet-sponsor"),
      owner = wallet("devnet-creator");
    const alias = client.normalizeAlias(
      process.argv[3] ||
        `vynx_${owner.publicKey.toBase58().slice(0, 12).toLowerCase()}`,
    );
    const config = client.decodeConfig(
      await connection.getAccountInfo(client.configPda()),
    );
    assert(config.sponsor.equals(sponsor.publicKey));
    const existing = await connection.getAccountInfo(client.aliasPda(alias));
    if (existing) {
      const record = client.decodeAlias(existing);
      assert(record.owner.equals(owner.publicKey));
      console.log("Existing smoke registration verified:", alias);
      return;
    }
    const price = config.tiers[Math.min(alias.length - 1, 4)];
    const before = await connection.getBalance(owner.publicKey);
    const treasuryBefore = await connection.getBalance(config.treasury);
    const slot = await connection.getSlot("confirmed");
    const signature = await send(
      client.registerIx(
        owner.publicKey,
        sponsor.publicKey,
        config.treasury,
        alias,
        price,
        config.priceVersion,
        slot + 120,
      ),
      sponsor,
      [owner],
    );
    assert.equal(
      BigInt(before - (await connection.getBalance(owner.publicKey))),
      price,
    );
    const record = client.decodeAlias(
      await connection.getAccountInfo(client.aliasPda(alias)),
    );
    assert(record.owner.equals(owner.publicKey));
    assert.equal(record.alias, alias);
    assert.equal(record.paidLamports, price);
    const index = await connection.getAccountInfo(
      client.ownerPda(owner.publicKey),
    );
    assert(index.owner.equals(client.PROGRAM_ID));
    assert(
      Buffer.from(index.data)
        .subarray(40, 72)
        .equals(client.aliasPda(alias).toBuffer()),
    );
    assert((await connection.getBalance(config.treasury)) > treasuryBefore);
    const proof = {
      network: "devnet",
      programId: client.PROGRAM_ID.toBase58(),
      signature,
      alias,
      owner: owner.publicKey.toBase58(),
      aliasPda: client.aliasPda(alias).toBase58(),
      ownerIndexPda: client.ownerPda(owner.publicKey).toBase58(),
      totalLamports: price.toString(),
      priceVersion: config.priceVersion.toString(),
      verifiedAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(root, "devnet-smoke.json"),
      JSON.stringify(proof, null, 2) + "\n",
    );
    console.log(
      "Verified alias:",
      alias,
      "PDA:",
      client.aliasPda(alias).toBase58(),
      "creator charge:",
      price.toString(),
      "lamports",
    );
  } else if (command === "fund") {
    const deployer = wallet("devnet-deployer");
    for (const [name, amount] of [
      ["devnet-sponsor", 100000000],
      ["devnet-creator", 50000000],
      ["devnet-treasury", 1000000],
    ]) {
      const recipient = wallet(name).publicKey;
      const current = await connection.getBalance(recipient);
      if (current >= amount) continue;
      await send(
        SystemProgram.transfer({
          fromPubkey: deployer.publicKey,
          toPubkey: recipient,
          lamports: amount - current,
        }),
        deployer,
        [],
      );
    }
  } else
    throw Error(
      "Commands: initialize, prices [five lamport values], fund, smoke [alias]",
    );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
