# Intendant

Personal finance web app with an AI assistant: import bank CSV exports, auto-categorize transactions, analyze spending over a period.

## Stack

- TanStack Start (frontend + backend)
- Supabase (Postgres, auth, storage), behind an infra abstraction layer
- Vercel AI SDK (LLM calls, agents)

## Rules

### Architecture
- Vendor SDKs (Supabase, S3, auth providers) are only imported in the infra layer. Domain and UI code never import them.
- Database access goes through the ORM over a direct Postgres connection, not `supabase-js`.
- File storage goes through the S3-compatible API.
- Schema changes are migrations, committed with the code. Never edit the database by hand.

### Code
- After adding or generating files (shadcn / AI Elements `add`, TanStack CLI, or hand-written), run `pnpm exec biome check --write` before committing. Generators don't follow our Biome config.

### Data & security
- Money is integer minor units (cents) plus a currency code. Never floats.
- Data is scoped by household. Every query checks household membership in app code (no RLS).
- User and household IDs come from the server-side session. Never trust them from the client or from LLM tool arguments.
- CSV imports are idempotent: re-importing an overlapping export must not create duplicates.
- Never commit real financial data. Test fixtures are fake and live under `fixtures/`.

### AI
- The LLM never does arithmetic. Tools return numbers computed in SQL; the LLM explains them.
- Categorization checks merchant rules first; the LLM is only called for unknown merchants.
- Send the LLM the minimum data needed: aggregates for analysis, not raw transaction lists.

### Deployment
- Prod is a home server on amd64; dev machines may be arm64. Docker images are built in CI, never shipped from a dev machine.
