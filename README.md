# VYNX

VYNX is a Solana creator-card application. The current MVP lets creators connect a Phantom wallet, claim an alias, publish a profile, and receive SOL tips.

> **Network:** the MVP supports **Solana devnet only**. Do not use a mainnet wallet RPC or fund the treasury with production SOL.

## Current stack

- Next.js 16 App Router, React 19, and TypeScript
- Tailwind CSS 4, shadcn/ui primitives, and Framer Motion
- Phantom React SDK (`@phantom/react-sdk` and `@phantom/browser-sdk`)
- Solana Web3.js
- Supabase Postgres and SSR helpers
- Vercel deployment

Supabase is the authoritative source of alias ownership for the MVP. A claim uses a devnet SOL transfer whose server-verified signature is stored with the unique wallet/alias record. The earlier Anchor prototype has been removed; it is available in Git history if on-chain alias ownership is reconsidered after the MVP.

## Prerequisites

- Node.js 20.9 or newer
- npm 10 or newer
- A Supabase project
- A Phantom Portal app ID
- A Solana devnet RPC URL and a devnet treasury wallet

## Local setup

The web application lives in `front/`.

```bash
git clone https://github.com/zuyux/vynx.git
cd vynx/front
cp .env.example .env.local
npm ci
```

Fill every value in `.env.local` using the comments in `.env.example`, then run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Configuration is validated before Next.js starts; a missing, placeholder, malformed, or known non-devnet value produces a list of actionable errors.

Never commit `.env.local`. `SUPABASE_SECRET_KEY` is server-only and deliberately does not use the `NEXT_PUBLIC_` prefix. Values prefixed with `NEXT_PUBLIC_` are bundled into browser code and must not contain secrets.

## Validation

Run the same frontend checks used by CI:

```bash
cd front
npm run check
```

This runs environment validation, ESLint, TypeScript, unit tests, and a production build. Pull requests run the same stages in GitHub Actions.

## Repository structure

```text
vynx/
├── front/                         # Next.js application
│   ├── app/                       # App Router pages and route handlers
│   ├── components/                # Shared React components
│   ├── lib/                       # Supabase and shared utilities
│   ├── scripts/                   # Environment validation
│   └── supabase/migrations/       # Database schema migrations
├── docs/                          # Architecture decisions
└── DEVROAD.MD                     # MVP delivery roadmap
```

## Database setup

Apply the SQL migrations in `front/supabase/migrations/` to the configured Supabase project in filename order. The current migration creates `public.cards_users` and its read policy.

## Product scope

See [DEVROAD.MD](DEVROAD.MD) for the MVP milestones and deferred features. Subscriptions, bookings, product delivery, token gating, and mainnet support are not part of the current MVP.

## License

GNU AGPLv3. See `LICENSE` when present in the distribution.
