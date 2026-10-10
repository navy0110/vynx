# VYNX on-chain alias registration policy

Status: proposed implementation policy, drafted October 9, 2026. The pricing target is a configurable SOL-denominated schedule approximating the requested USD logarithmic curve and including registration costs. The current application still uses the Supabase/devnet claim flow; this document does not change its live price or ownership authority.

## Price and cost allocation

A successful first registration costs a one-time SOL amount determined by canonical name length, with no renewal fee. Prices are fixed in SOL until the registration admin updates them on-chain. They are approximate dollar equivalents, not a USD peg, and replace the previous live-conversion proposal.

The requested reference curve is `max(1, 100 - 99 * ln(n) / ln(5))` USD for length n. Using an indicative SOL/USD quote of $108.99 on October 9, 2026 and rounding to simple SOL amounts gives this initial schedule:

| Characters | Total SOL price | Approximate USD at reference rate |
| --- | ---: | ---: |
| 1 | 0.92 | $100.27 |
| 2 | 0.53 | $57.76 |
| 3 | 0.30 | $32.70 |
| 4 | 0.14 | $15.26 |
| 5–30 | 0.01 | $1.09 |

Count every permitted ASCII character, including digits and underscores; do not count the display @. The 5–30 character tier includes the requested 5–12 range. These rounded tiers approximate the logarithmic curve rather than matching it exactly.

Store prices directly as integer lamports on-chain. No price oracle, live exchange-rate conversion, or USD-denominated account fields are needed. Optional USD displays are informational only. P is the applicable tier's configured lamport amount; checkout always shows the actual SOL debit.

Bind the SOL amount, pricing version, owner, alias, cluster, and expiry into the signed authorization. The program checks the authorized amount against the current tier. Expired quotes or changed prices require a new creator signature.

VYNX sponsors the transaction fee so the wallet is not charged an extra network fee. The creator signs as the registration owner; a separate VYNX fee payer signs and pays the base and priority fees. Wallets must not modify the signed message or add another creator-paid transaction. If this sponsored flow is unavailable, registration is unavailable rather than silently charging more.

Within one atomic registration transaction:

- The creator funds the rent-exempt deposits for every new registry account required by the claim, totaling R lamports.
- The creator pays the VYNX treasury P minus R lamports.
- VYNX pays the network fee N separately. Its net registration proceeds are P minus R minus N, before operating costs.

If a third party prefunds a registry PDA, only the creator-funded deposit is deducted from the treasury payment; the creator still pays P in total.

The deposit remains locked in the registry accounts; it is not spendable VYNX revenue or a refundable creator balance under this policy. No accounts can be closed in the initial release. Program deployment, RPC, indexing, and support expenses are paid by VYNX and are not added at checkout.

Use the chain's current rent requirements for the final account sizes and estimate network fees from the final transaction message, including both signatures and any compute budget instructions. Do not hard-code a rent estimate. Reject a quote if deposits and network fees exceed the price budget or a configured sponsor fee limit. Never silently increase the price.

Illustrative allocation only: for the 5–30 character tier with P = 0.01 SOL, deposits total 0.002 SOL, and the network fee is 0.00002 SOL, the creator spends 0.01 SOL, the treasury receives 0.008 SOL, and VYNX retains 0.00798 SOL after the sponsored fee. Actual account deposits and network fees are calculated from the registration transaction.

Checkout shows the alias, network, owner wallet, quoted total SOL price P, account deposits, treasury payment, and network fee marked "covered by VYNX." Quotes expire with their transaction blockhash; requoting does not reserve a name.

## On-chain price administration

Store a singleton program-owned configuration PDA derived from `["config"]`, containing `registration_admin: Pubkey`, `price_tiers_lamports: [u64; 5]`, and `price_version: u64`. The fifth tier applies to every length from 5 through 30. Initially set tiers to `[920000000, 530000000, 300000000, 140000000, 10000000]` and the admin to an authority chosen by the deployer. Price administration is distinct from program upgrade authority.

Initialize this account once, requiring the verified deployment/upgrade authority or an explicitly pinned bootstrap signer. An arbitrary caller must not be able to initialize first and become admin. Registration rejects missing, incorrectly derived, or incorrectly owned configuration accounts.

Provide `set_registration_price_tiers(new_tiers_lamports)`, requiring the current registration admin's signature and the canonical configuration PDA. Use integer lamports and checked arithmetic. Require five positive, non-increasing tiers. Updates change the tier table; a future curve can be calculated off-chain and submitted as integer tiers. At quote/execution time, reject SOL prices below the current deposits required for registration. Sponsorship must also fit within the price budget and VYNX's separate network-fee limits; otherwise registration pauses without adding a creator charge.

Each update increments `price_version` and emits the admin, old price, new price, and version. Updates affect registrations executed afterward; existing owners owe no additional payment.

Registration includes `expected_total_lamports` and `expected_price_version`, both bound into VYNX's signed authorization. The program requires an exact pricing-version and applicable tier-price match with configuration and a valid signed authorization at execution and computes treasury payment as P minus actual required deposits. A mismatch fails atomically with a price-changed error. Refresh the quote and obtain a new creator signature, even if the price decreased. VYNX covers the network fee for a failed sponsored attempt.

The client reads configuration and the registration quote from the intended cluster before checkout and displays the current SOL tier price. Never change the amount in an already signed transaction or trust a client-supplied treasury amount.

Provide two-step admin rotation: the current admin nominates a non-default pending admin, who must sign acceptance. The current admin can replace or cancel a nomination. Prefer a multisig authority for production. These admin powers do not permit alias confiscation, reassignment, or closure; disclose program upgrade powers separately.

## Name eligibility and reservations

- Canonical names contain 1–30 lowercase ASCII letters, digits, or underscores. Trim whitespace and a single leading @ before validation. Case variants share one name. Reject punctuation, Unicode, invisible characters, and domain suffixes.
- Names are VYNX identities such as @fabohax. Registration does not confer ownership of fabohax.sol, fabohax.sns, a trademark, or a DNS domain.
- Reserve application routes and operational identities, including api, auth, dashboard, admin, support, help, security, treasury, official, vynx, and system. Maintain and publish a versioned complete list before launch.
- Reservations must be checked by the program, not only the website. Reserved names cannot be issued through the ordinary paid instruction. Initial release leaves them unclaimed; issuance needs a separately reviewed policy.
- New reservations cannot retroactively revoke existing registrations. Similar spelling alone does not confer verified or official status.

## Ownership and lifecycle

- The program is the sole ownership authority after migration. Derive an alias PDA from the canonical alias and an owner-index PDA from the wallet; enforce one alias per wallet and one owner per alias atomically.
- Registration requires the owner's signature. An availability lookup is advisory; the first successful on-chain registration wins.
- Initial registrations do not expire. No resale, transfer, rename, release, closure, or administrator reassignment instruction ships in the initial release. Lost-wallet recovery is not available; disclose this before purchase. Future transfer or recovery requires a separate policy and program review.
- Alias ownership does not grant a verification badge or endorsement. Profiles and content remain subject to VYNX moderation.
- Moderation can hide a profile, remove content, or exclude it from search. It does not confiscate or reassign its on-chain alias. Publish a report and appeal process before public launch; do not promise on-chain reversal through support.

## Anti-squatting and fee sponsorship

- One alias per wallet reduces casual bulk registration but does not prevent one person using multiple wallets. Do not describe it as one alias per person.
- Apply authenticated registration-intent limits, IP-based abuse controls, and a challenge when suspicious activity is detected. Do not ban shared networks solely for having multiple creators.
- In the initial release, require a short-lived VYNX authorization signed over the owner, canonical alias, program, cluster, SOL price, pricing version, expiry, and unique intent ID. The configured sponsor co-signs the complete registration transaction. The program checks its signer role, price/version, expiry, and ownership uniqueness; the completed alias records the intent ID. This prevents successful replay for the same owner or alias without adding a separate rent-bearing intent account. This lets VYNX control admission; existing ownership and resolution do not require VYNX availability.
- The sponsor signs only approved, simulated registration messages with the expected program, PDAs, treasury, accounts, instruction data, cost caps, and signer set. It must not sponsor arbitrary wallet-provided transactions.
- Use a durable sponsorship ledger and a funded-wallet spending limit. Keep at most one unresolved sponsored attempt per intent. Resubmit the same signed transaction before expiry; before building another, reconcile the signature and registry accounts.
- Publish the sponsor's priority-fee ceiling and operational registration limits before launch. Exhausting the budget pauses new registrations and leaves existing aliases resolvable.

## Failure, retries, and refunds

- Registration, deposits, and treasury payment are atomic. A failed transaction creates no alias and charges the creator no registration payment; VYNX may still pay network fees. Declining a signature costs the creator nothing.
- A submitted transaction with an unknown outcome remains pending. Reconcile its signature and PDAs before asking for another signature. Never make a second charge to recover an already successful registration.
- If the alias is taken before execution, the registration fails without collecting the creator's payment. There is no prepayment transfer or off-chain promise of reservation.
- Successful registrations are final under this policy, with no automatic refund for typos, lost wallets, inactivity, or profile moderation. VYNX may issue a separate goodwill payment without deleting or reassigning the alias.

## Migration and release requirements

Keep the current flow authoritative until a defined cutover. Pause new claims during migration, reconcile verified Supabase claims, and preserve existing canonical alias/owner pairs without charging them again. Owner signatures or a narrowly scoped migration instruction are required; VYNX funds migration costs. Publish the migration rules and program address before cutover.

After cutover, Supabase stores profiles and an index of chain ownership. Database rows alone cannot establish ownership. Verify the expected program owner, PDA derivations, discriminator/version, canonical alias, owner wallet, and owner index from confirmed chain state before granting editing access. Background indexing must reconcile chain changes; old treasury payments must not create new registry ownership.

Validate the complete flow on devnet before enabling mainnet. Devnet charges are test SOL. The Anchor registry is implemented in `chain/` and passes local signed-transaction runtime tests. Devnet deployment status and usage are documented in `chain/README.md`. Production sponsorship controls, frontend integration, independent security review, migration tests, and mainnet release remain outstanding. This policy is not proof of application cutover.

## Technical references

- Solana transaction fees: https://solana.com/docs/core/fees/fee-structure
- Rent-exempt account sizing: https://solana.com/docs/rpc/http/getminimumbalanceforrentexemption

- Initial SOL/USD reference: market-data quote retrieved October 9, 2026 ($108.99 per SOL); informational only and never used by the program.
