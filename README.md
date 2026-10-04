# Intendant

Personal finance web app with an AI assistant: import bank CSV exports, auto-categorize transactions, analyze spending over a period.

## Local development

Prerequisites: Node, pnpm, and a Docker runtime ([OrbStack](https://orbstack.dev) recommended on macOS).

```sh
pnpm install
pnpm exec supabase start      # Postgres, Auth, Storage in Docker (first run pulls images)
cp .env.example .env.local    # then fill in the keys from `pnpm exec supabase status`
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
