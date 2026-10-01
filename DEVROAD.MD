# VYNX Development Roadmap

This roadmap defines the shortest path from the current repository to a working minimum viable prototype (MVP).

## MVP outcome

A creator can:

1. Open VYNX without an automatic wallet prompt.
2. Connect a Phantom wallet intentionally.
3. Claim one unique alias by paying the configured SOL fee.
4. Edit and save a basic creator card.
5. Share a public URL such as `vynx.me/@alice`.

A visitor can:

1. Open a creator card without connecting a wallet.
2. See the creator's saved profile.
3. Connect a wallet intentionally and send a SOL tip.
4. See a clear success or failure result.

The MVP is complete only when this entire journey works on production with real devnet transactions and persistent Supabase data.

## Scope decisions

### Included in MVP

- Phantom wallet connection
- Wallet ownership verification
- Unique alias claim
- Persistent creator profile
- Public creator page
- SOL tips
- Basic creator activity and earnings summary
- Mobile-friendly production deployment
- Essential security, validation, errors, and tests

### Deferred until after MVP

- Recurring subscriptions and Streamflow
- Digital product uploads and delivery
- Paid bookings and video calls
- NFT or token-gated content
- USDC payments
- Alias transfer and release UI
- Advanced themes and page blocks
- Full analytics, referrals, affiliates, and recommendations
- Mainnet launch

## Current baseline

- [x] Next.js application and landing page
- [x] Phantom React SDK integration
- [x] Supabase client/server helpers
- [x] Initial `cards_users` migration
- [x] Alias payment transaction builder
- [x] Alias confirmation endpoint
- [x] Creator dashboard and editor UI mockups
- [x] Public profile UI mockup
- [x] Vercel production project and domains
- [ ] Wallet-authenticated application session
- [ ] Server-side transaction verification
- [ ] Persistent profile editor
- [ ] Dynamic public creator route
- [ ] Working tip flow
- [ ] Automated end-to-end test

## Priority legend

- **P0**: blocks the MVP user journey or protects money/data
- **P1**: required for a usable MVP release
- **P2**: valuable immediately after MVP

---

## Milestone 0 — Stabilize the foundation

Goal: make local, CI, and production behavior predictable before adding features.

- [x] **P0** Update `README.md` to match the actual stack and directory structure (Next.js 16, `front/`, current Phantom SDK).
- [x] **P0** Document devnet as the only supported MVP cluster.
- [x] **P0** Add explicit environment validation with helpful startup errors for:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_KEY`
  - `SUPABASE_SECRET_KEY`
  - `NEXT_PUBLIC_TREASURY_WALLET`
  - `NEXT_PUBLIC_SOLANA_RPC_URL`
  - `NEXT_PUBLIC_APP_URL`
  - `NEXT_PUBLIC_PHANTOM_APP_ID`
- [x] **P0** Ensure secrets never use the `NEXT_PUBLIC_` prefix.
- [x] **P0** Add scripts for `typecheck`, `test`, and `check` (`lint + typecheck + test + build`).
- [x] **P1** Add CI that runs `npm ci`, lint, typecheck, tests, and build for every pull request.
- [x] **P1** Decide whether alias ownership is authoritative in the Anchor program or Supabase for the prototype; use one source of truth, not both.
- [x] **P1** Remove or archive duplicate/unused contract sources after that decision.

Acceptance criteria:

- A new developer can run the app using only `README.md` and `.env.example`.
- Missing configuration fails clearly instead of producing a runtime crash.
- One command validates the frontend before deployment.

---

## Milestone 1 — Wallet authentication and authorization

Goal: prove wallet ownership and protect creator-only routes and mutations.

- [ ] **P0** Add a nonce endpoint that issues short-lived, single-use sign-in challenges.
- [ ] **P0** Ask the wallet to sign the challenge after the user explicitly chooses to connect.
- [ ] **P0** Verify the signature on the server and create a secure HTTP-only session.
- [ ] **P0** Bind each application session to one wallet address.
- [ ] **P0** Protect `/dashboard`, `/dashboard/*`, and creator mutation APIs.
- [ ] **P0** Reject profile edits when the session wallet does not own the profile.
- [ ] **P0** Add logout that clears both the Phantom connection and application session.
- [ ] **P1** Redirect authenticated creators without an alias to the claim flow.
- [ ] **P1** Redirect authenticated creators with an alias to the dashboard.
- [ ] **P1** Preserve the intended destination through the connect/callback flow.

Acceptance criteria:

- Opening the landing page never prompts for a wallet.
- Connect happens only after a user action.
- A forged wallet address in an API body cannot authorize a mutation.
- Unauthenticated users cannot access creator dashboard data.

---

## Milestone 2 — Secure alias claim

Goal: make alias purchase atomic, verifiable, and safe to retry.

- [ ] **P0** Centralize alias normalization and validation on client and server:
  - lowercase only
  - 3–30 characters
  - letters, numbers, and underscore only
  - reserved-name denylist (`admin`, `api`, `dashboard`, `support`, and similar routes)
- [ ] **P0** Add an alias availability endpoint with rate limiting.
- [ ] **P0** Validate public keys and configuration before building a transaction.
- [ ] **P0** In the confirmation endpoint, fetch the transaction from Solana RPC and verify:
  - signature exists and is finalized/confirmed
  - expected signer paid
  - expected treasury received the exact minimum amount
  - transaction is on the configured cluster
  - signature has not been used before
- [ ] **P0** Never create an alias from an unverified `account` and `signature` request body.
- [ ] **P0** Enforce one alias per wallet and one wallet per alias at the database level.
- [ ] **P0** Make confirmation idempotent so retries return the existing successful claim.
- [ ] **P0** Handle the race where two wallets attempt to claim the same alias.
- [ ] **P1** Display actionable errors for rejected signature, insufficient payment, taken alias, RPC timeout, and user cancellation.
- [ ] **P1** Store claim cluster, amount, treasury, signature, and verification timestamp.
- [ ] **P1** Decide whether the existing Anchor alias program is used in the MVP. If used, build its instruction instead of a plain treasury transfer and verify the PDA.

Acceptance criteria:

- A valid devnet payment creates exactly one alias record.
- A fake, failed, reused, or underpaid transaction creates no record.
- Refreshing or retrying after success does not double-charge or duplicate data.

---

## Milestone 3 — Persistent creator card

Goal: replace the dashboard mock with creator-owned data.

- [ ] **P0** Add a migration for creator card fields:
  - display name
  - bio
  - avatar URL
  - banner URL
  - social links
  - theme/accent color
  - published status
- [ ] **P0** Add ownership-safe server queries and update actions.
- [ ] **P0** Load the signed-in creator's real profile in `/dashboard/mypage`.
- [ ] **P0** Make “Save Changes” persist data and show saving, success, and error states.
- [ ] **P0** Keep the claimed username read-only in the editor.
- [ ] **P1** Add field length limits and URL validation.
- [ ] **P1** Add image upload using Supabase Storage with MIME type and size limits.
- [ ] **P1** Remove replaced images to avoid orphaned storage objects.
- [ ] **P1** Make the dashboard and editor usable on mobile; replace the fixed-width sidebar with responsive navigation.
- [ ] **P1** Add unsaved-changes protection.

Acceptance criteria:

- A creator can reload the browser and still see all saved profile changes.
- A different wallet cannot read private editor data or modify the card.
- Invalid text, links, and uploads are rejected with clear messages.

---

## Milestone 4 — Public creator pages

Goal: deliver a real, shareable creator card backed by Supabase.

- [ ] **P0** Replace the static `/profile` mock with a dynamic route such as `/@/[username]` or `/[username]`.
- [ ] **P0** Fetch public profile data by normalized username.
- [ ] **P0** Return a real 404 for missing or unpublished profiles.
- [ ] **P0** Render saved avatar, banner, display name, bio, and social links.
- [ ] **P1** Add per-profile metadata, canonical URL, Open Graph image, and social preview text.
- [ ] **P1** Add copy-link and native share actions.
- [ ] **P1** Prevent dashboard, API, asset, and reserved route collisions if using a root-level username route.
- [ ] **P1** Add loading and empty states without exposing internal errors.
- [ ] **P1** Verify accessibility: keyboard navigation, focus states, labels, color contrast, and reduced-motion behavior.

Acceptance criteria:

- `vynx.me/@username` loads without wallet connection.
- Public content matches the latest saved creator data.
- Shared links generate correct previews and missing aliases return 404.

---

## Milestone 5 — SOL tipping

Goal: complete the first creator monetization loop.

- [ ] **P0** Add creator payout wallet and tip settings to the profile model.
- [ ] **P0** Default payout to the verified owner wallet; require signed ownership to change it.
- [ ] **P0** Add fixed and custom SOL tip amounts with sane minimum/maximum limits.
- [ ] **P0** Build the transfer using the configured RPC cluster and creator payout address.
- [ ] **P0** Add a server confirmation endpoint that verifies the on-chain transfer before recording it.
- [ ] **P0** Make tip confirmation idempotent by transaction signature.
- [ ] **P0** Record payer, creator, amount, signature, cluster, status, and timestamps.
- [ ] **P1** Show pending, confirmed, rejected, and failed states to the fan.
- [ ] **P1** Display real tip totals and recent tip activity in the creator dashboard.
- [ ] **P1** Add a Solana Action/Blink endpoint for public tip links.
- [ ] **P1** Add privacy controls for whether payer addresses appear in creator activity.

Acceptance criteria:

- A visitor can send a devnet SOL tip from a public profile.
- The creator receives the expected amount and sees the verified event in the dashboard.
- Fake or reused transaction signatures do not create tip records.

---

## Milestone 6 — Reliability, security, and release readiness

Goal: make the complete prototype safe enough for invited users.

- [ ] **P0** Add unit tests for alias validation, transaction verification, authorization, and amount conversion.
- [ ] **P0** Add integration tests for profile persistence and payment confirmation idempotency.
- [ ] **P0** Add an end-to-end happy path:
  - visit landing page without a wallet popup
  - connect intentionally
  - claim alias
  - edit and publish card
  - visit public card
  - send tip
  - confirm dashboard activity
- [ ] **P0** Add negative end-to-end coverage for taken aliases and failed/cancelled transactions.
- [ ] **P0** Rate-limit public mutation and payment endpoints.
- [ ] **P0** Add structured server logs without secrets or full sensitive payloads.
- [ ] **P0** Add error monitoring and alerts for failed payment verification and API 5xx responses.
- [ ] **P0** Review Supabase RLS, service-role usage, CORS, session cookies, and public data exposure.
- [ ] **P0** Confirm all production environment variables and URLs.
- [ ] **P1** Add user-facing Terms, Privacy, fee disclosure, network disclosure, and support contact.
- [ ] **P1** Add database backup/restore notes and rollback instructions.
- [ ] **P1** Test current Chrome, Safari, Firefox, and mobile viewport behavior.
- [ ] **P1** Run a small invited-user test and record blocking feedback.

Acceptance criteria:

- CI passes from a clean checkout.
- No P0 defects remain open.
- Production smoke tests pass on both `vynx.me` and `vynx-ten.vercel.app`.
- A new creator and fan can complete the MVP journey without developer intervention.

---

## Suggested database additions

Create these through new, numbered migrations; do not edit an already-applied migration.

- `wallet_nonces`: nonce, wallet, expiry, used timestamp
- `wallet_sessions` or an equivalent secure session store
- extended `cards_users`: creator card and publication fields
- `social_links`: creator, platform, URL, display order
- `alias_claims`: wallet, alias, amount, treasury, cluster, signature, verification status
- `tips`: creator, payer, amount, currency, cluster, signature, status, timestamps

Every payment signature must have a unique database constraint.

## Suggested delivery order

Work in vertical slices and keep production deployable after each slice:

1. Foundation and wallet-authenticated session
2. Verified alias claim
3. Persistent creator editor
4. Dynamic public profile
5. Verified SOL tip
6. End-to-end hardening and invited-user release

Do not start subscriptions, products, or bookings until the full alias-to-tip path passes end-to-end tests.

## Definition of done for every task

A task is done when:

- implementation is complete and contains no mock data for that behavior;
- authorization and input validation are enforced server-side;
- loading, empty, success, and failure states are handled;
- relevant automated tests are added or updated;
- `npm run lint` and `npm run build` pass;
- environment and migration changes are documented;
- the change is verified on a preview deployment before production promotion.

## MVP release checklist

- [ ] Landing page does not request a wallet automatically.
- [ ] Intentional wallet connect and logout work.
- [ ] Wallet ownership is verified server-side.
- [ ] Alias availability and claim work on devnet.
- [ ] Alias payments are verified on-chain.
- [ ] Creator profile edits persist.
- [ ] Public creator URLs resolve correctly.
- [ ] SOL tips complete and are verified on-chain.
- [ ] Dashboard uses real profile and tip data.
- [ ] Mobile and accessibility checks pass.
- [ ] CI, production build, migrations, and smoke tests pass.
- [ ] Monitoring, support contact, disclosures, and rollback notes are ready.

When every item above is checked, VYNX has a working minimum viable prototype suitable for a controlled devnet beta.
