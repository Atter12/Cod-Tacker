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

Populate `.env.local` with the values described in [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md). The local application is served at the configured app URL (typically `http://localhost:3000`).

## Generate database types

After linking the intended Supabase project, regenerate the checked-in database contract:

```bash
# bash / Git Bash
npx supabase gen types typescript --project-id PROJECT_ID --schema public > types/database.generated.ts
```

En PowerShell, evita `>` (escribe UTF-16 y rompe ESLint). Usa:

```powershell
npx supabase gen types typescript --project-id PROJECT_ID --schema public | Set-Content -Encoding utf8 types/database.generated.ts
```

Importa filas tipadas desde `@/types/database` (`OrderRow`, `AgencyRow`, etc.). Esos aliases se basan en `Tables<"...">` y no se pierden al regenerar `database.generated.ts`.

Review the generated diff before committing it. The application depends on that contract for table, role, and enum typing.

## Validate

```bash
npm run lint
npm run typecheck
npm run build
npm run test:rls
```

`test:rls` requires its own tenant fixtures and environment variables; see [RLS_TESTING.md](./RLS_TESTING.md).
