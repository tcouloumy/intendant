# Intendant

Personal finance web app with an AI assistant: import bank CSV exports, auto-categorize transactions, analyze spending over a period.

## Local development

Prerequisites: Node, pnpm, and a Docker runtime ([OrbStack](https://orbstack.dev) recommended on macOS).

```sh
pnpm install
pnpm exec supabase start      # Postgres, Auth, Storage in Docker (first run pulls images)
cp .env.example .env.local    # then fill in the keys from `pnpm exec supabase status`
pnpm db:migrate               # apply migrations
pnpm dev                      # http://localhost:3000
```

Local services:

| Service  | URL                                                      |
| -------- | -------------------------------------------------------- |
| API      | http://127.0.0.1:54421                                   |
| Postgres | postgresql://postgres:postgres@127.0.0.1:54422/postgres  |
| Studio   | http://127.0.0.1:54423                                   |
| Mailpit  | http://127.0.0.1:54424                                   |

`pnpm exec supabase stop` stops the stack and keeps the data. Add `--no-backup` to wipe it.

## Database

Drizzle ORM over a direct Postgres connection. Client and schema live in `src/infra/db/`; app tables live in the `app` Postgres schema, which Supabase's REST API doesn't expose.

```sh
pnpm db:generate --name <change>   # schema.ts → new SQL migration in drizzle/
pnpm db:migrate                    # apply pending migrations
pnpm db:studio                     # browse the database
```

- Migrations in `drizzle/` are committed. Never edit one that has been applied; generate a new one.
- drizzle-kit is the only migration tool: `supabase/migrations` stays empty.
- `pnpm exec supabase db reset` wipes the `app` schema too. Run `pnpm db:migrate` afterwards.
