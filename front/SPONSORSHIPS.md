# Vynx sponsorship MVP

This first version connects creators and brands through a single sponsored text card on each creator's Vynx page. It runs on Solana devnet only; test USDC has no monetary value.

## Setup

1. Install the project dependencies with `npm install` (Node 22.14 or later).
2. Configure `.env.local` using `.env.example`. Do not place the Supabase secret key in a public variable.
3. Apply `supabase/migrations/001_profiles.sql` if not already applied, then `002_sponsorships.sql`, in the Supabase SQL editor. The new migration does not change existing creator cards.
4. Start the application with `npm run dev` and open `/dashboard/sponsorships`.

The sponsorship payment service deliberately uses `https://api.devnet.solana.com` and Circle's devnet USDC mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`. It does not use the alias treasury. A wallet needs devnet USDC plus devnet SOL for transaction fees and, if needed, the creator's token account rent. Circle's test faucet: https://faucet.circle.com/ .

## Demo walkthrough

1. Connect creator wallet A. Load existing campaigns before editing an existing offer. Save an alias, name, bio, link, price and duration.
2. Open `/creators/<alias>` to see the public page. Visitors can browse without connecting a wallet.
3. With brand wallet B, submit a brand name, headline, description and HTTPS destination. There is no payment yet.
4. With wallet A, load campaigns and approve or reject the request. Only one sponsorship can be approved or live at a time.
5. With wallet B, load campaigns, review the terms and pay the approved request. The wallet switches to devnet. Payment is sent directly to wallet A.
6. The server verifies a finalized transaction, the payer signature, the exact USDC transfer, receiving token balance and unique campaign memo. Only then does the database atomically activate the campaign.
7. Refresh the public page to see the card marked “Patrocinado”. Expired campaigns are filtered by the server and removed from an open page by its expiry timer.
8. If confirmation is interrupted, use the transaction signature in “Verificar pago existente”; do not send a second payment. The browser saves a recovery reference when storage is available.

## Scope and limitations

- Profiles and campaigns persist in Supabase. Private requests use server-issued, expiring, single-use Ed25519 wallet challenges bound to the origin, action and exact payload. Browser clients cannot access the new tables directly.
- The agreed price, duration and creative are frozen in the request; later profile edits do not change them.
- Approval reserves the exclusive space until payment. Cancellation, approval expiry and refund flows are not implemented.
- Direct transfers have no escrow or automatic delivery guarantee. No real-money launch is intended in this version.
- Public pages expose the creator receiving wallet. Brand wallets and pending requests are not returned by the public endpoint.
- Ads are text cards on Vynx. Images, external-site embedding, auctions, impression/click billing, analytics, subscriptions and automatic social publishing are outside this first slice.
- Before a public pilot, add distributed rate limiting, operational challenge cleanup, moderation/reporting, cancellation/refunds and end-to-end checks with the deployed database and wallets. Current per-wallet limits are basic abuse friction, not Sybil prevention.
- The existing alias purchase flow is separate. Its legacy confirmation endpoint does not verify its payment; do not rely on it as sponsorship authorization or release it for real-money alias sales.

## Verification

`npm run typecheck`, `npm run lint`, and `npm test` cover code checks, offer validation, ad URL restrictions, review permissions, campaign time windows, wallet signatures and payment-matching failures. They do not replace applying and testing the SQL functions in a Supabase instance or sending a real devnet test payment.

## Publicar el diseño del creador

Aplica `supabase/migrations/003_creator_design.sql` después de la migración 002. En `/dashboard/mypage`, conecta la wallet, carga su perfil publicado y publica el diseño actual. Primero debe existir una oferta en Patrocinios. El editor mantiene un borrador local independiente y permite traer el diseño publicado sin sobrescribir cambios pendientes.

El servidor valida el diseño y limita el cuerpo a 3 MB; las imágenes raster pequeñas se guardan dentro del JSON del perfil para este MVP. Las firmas incluyen el hash completo del diseño y las imágenes, aunque el mensaje de wallet muestra solo un resumen legible. La actualización se limita a la wallet firmante y no cambia precios, duración ni condiciones de campañas existentes. Cambiar el alias cambia el enlace público; los aliases de este módulo son independientes del flujo legacy de compra de alias.

Antes de escalar el piloto, migra las imágenes a object storage. Esta implementación no aplica migraciones automáticamente ni reemplaza una prueba de publicación con Supabase y wallets reales en devnet.
