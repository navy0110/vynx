import assert from "node:assert/strict";
import test from "node:test";
import { REQUIRED_ENV_KEYS, validateEnvironment } from "../scripts/env-validation.mjs";

const validEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_KEY: "anon-key-value",
  SUPABASE_SECRET_KEY: "server-secret-value",
  NEXT_PUBLIC_TREASURY_WALLET: "11111111111111111111111111111111",
  NEXT_PUBLIC_SOLANA_RPC_URL: "https://api.devnet.solana.com",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_PHANTOM_APP_ID: "phantom-app-id",
};

test("accepts a complete devnet configuration", () => {
  assert.deepEqual(validateEnvironment(validEnvironment), []);
});

test("reports every missing required value", () => {
  const errors = validateEnvironment({});
  assert.equal(errors.length, REQUIRED_ENV_KEYS.length);
  for (const key of REQUIRED_ENV_KEYS) {
    assert.ok(errors.includes(`${key} is required.`));
  }
});

test("rejects known non-devnet RPC endpoints", () => {
  for (const network of ["mainnet-beta", "testnet"]) {
    const errors = validateEnvironment({
      ...validEnvironment,
      NEXT_PUBLIC_SOLANA_RPC_URL: `https://api.${network}.solana.com`,
    });
    assert.ok(errors.some((error) => error.includes("must target Solana devnet")));
  }
});

test("rejects placeholders, malformed values, and public secrets", () => {
  const errors = validateEnvironment({
    ...validEnvironment,
    NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
    NEXT_PUBLIC_TREASURY_WALLET: "not a public key",
    NEXT_PUBLIC_APP_URL: "https://vynx.me/",
    NEXT_PUBLIC_PHANTOM_APP_ID: "your-phantom-app-id",
    NEXT_PUBLIC_PRIVATE_KEY: "leaked",
  });

  assert.ok(errors.some((error) => error.includes("SUPABASE_URL must be")));
  assert.ok(errors.some((error) => error.includes("TREASURY_WALLET must be")));
  assert.ok(errors.some((error) => error.includes("trailing slash")));
  assert.ok(errors.some((error) => error.includes("placeholder")));
  assert.ok(errors.some((error) => error.includes("public NEXT_PUBLIC_ prefix")));
});
