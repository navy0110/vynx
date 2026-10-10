# MVP alias ownership decision

**Status:** accepted for the MVP.

**Planned revision (October 9, 2026):** move alias ownership to a VYNX
on-chain registry with fixed SOL tiers approximating a logarithmic USD curve:
0.92 SOL for one character down to 0.01 SOL for 5–30 characters,
configurable on-chain by an admin authority chosen by the deployer. See the
[registration policy](alias-registration-policy.md) for pricing, reservations,
abuse controls, and migration requirements. The new Anchor program is deployed and smoke-tested on devnet; see
[chain/](../chain/README.md) for the program address and transaction evidence.
Frontend integration and ownership cutover are pending. The decision below
describes the current application.

Supabase Postgres is the sole authoritative source of alias ownership. The
`public.cards_users` table enforces unique wallet addresses and usernames. A
claim is accepted only after the API verifies its Solana devnet payment; that
verification is implemented in Milestone 2.

The MVP does not invoke an Anchor program or use PDAs for alias ownership. The
previous Anchor and loose Rust contract prototypes were removed in Milestone 0
because retaining a second ownership model creates ambiguous state and a
possible split-brain claim result. Those sources remain recoverable from Git
history (before Milestone 0).

The planned registry cutover must follow the migration policy and make the
program the sole ownership authority. Supabase will remain a profile store and
chain index after that cutover.
