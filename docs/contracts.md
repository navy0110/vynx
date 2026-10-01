# MVP alias ownership decision

**Status:** accepted for the MVP.

Supabase Postgres is the sole authoritative source of alias ownership. The
`public.cards_users` table enforces unique wallet addresses and usernames. A
claim is accepted only after the API verifies its Solana devnet payment; that
verification is implemented in Milestone 2.

The MVP does not invoke an Anchor program or use PDAs for alias ownership. The
previous Anchor and loose Rust contract prototypes were removed in Milestone 0
because retaining a second ownership model creates ambiguous state and a
possible split-brain claim result. Those sources remain recoverable from Git
history (before Milestone 0).

Reintroducing an on-chain registry requires a new architecture decision and a
migration plan that makes the program—not both systems—the authority.
