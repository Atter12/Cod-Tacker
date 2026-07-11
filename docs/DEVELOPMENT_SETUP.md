# Development setup

## Prerequisites

- Node.js 24
- npm
- A Supabase project

## Install and run

```bash
npm install
cp .env.example .env.local
npm run dev
```

Populate `.env.local` using [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md). App URL typically `http://localhost:3000`.

## Generate database types

After applying migrations and linking the project:

```bash
# bash / Git Bash
npx supabase gen types typescript --project-id PROJECT_ID --schema public > types/database.generated.ts
```

PowerShell (avoid `>` UTF-16):

```powershell
npx supabase gen types typescript --project-id PROJECT_ID --schema public | Set-Content -Encoding utf8 types/database.generated.ts
```

Import row aliases from `@/types/database`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local Next.js |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:unit` | Domain unit tests (`lib/**/*.test.ts`) |
| `npm run test:rls` | Multi-tenant RLS script |
| `npm run build` | Production build |
| `npm run validate` | lint + typecheck + test:unit + build |
| `npm run seed:demo` / `clear:demo` | Demo fixtures |
| `npm run jobs:process` | Claim/process background jobs (`ALLOW_JOB_WORKER=true`) |
| `npm run e2e:matrix` | Print E2E checklist + health probes |

## Validate (Integration-Ready)

```bash
npm run validate
```

Optional: `npm run test:rls` (requires fixtures — [RLS_TESTING.md](./RLS_TESTING.md)).  
Optional: `npm run e2e:matrix` with app running for health probe.
