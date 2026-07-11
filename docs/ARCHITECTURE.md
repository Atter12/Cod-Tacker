# Architecture — Integration-Ready V1

CODTracked is a Next.js App Router application backed by Supabase. Route components are server components by default; client interactivity is isolated in reusable UI components.

**Release name:** Integration-Ready V1 (mock providers). Not “producción con integraciones reales”.

## Layers

- `app/`: routes, layouts, and server actions.
- `components/`: reusable presentation components and application shells.
- `services/`: typed query/use-case functions using the caller's Supabase client.
- `lib/`: Supabase clients, auth guards, jobs, integrations, security, observability.
- `config/`: routes, navigation, environment validation, permissions.
- `types/`: generated Supabase database contract plus domain types.
- `features/`: thin re-exports of domain services for feature boundaries.

## Routing and tenancy

Tenant routes use `/a/:agencySlug` and `/a/:agencySlug/s/:storeSlug`. Platform console: `/admin`.

Canonical store UI: `app/a/[agencySlug]/s/[storeSlug]/*`. Routes under `app/(app)/*` (except `/dashboard` and `/profile`) are legacy stubs redirecting to `/dashboard`.

Admin UI uses the request-scoped client — **no service role for UI reads**; RLS is authoritative.

## Server Actions

Prefer `ActionResult<T>` from `lib/actions/action-result.ts` and `toUserMessage`. Sensitive actions write `audit_logs`. CSRF: Next.js Server Actions cookie + same-origin posture.

## Integrations pipeline

```
Provider (mock|live) → raw_events → background_jobs → handlers → domain tables → UI/services
```

Contracts: `lib/integrations/contracts/`. Mocks: `lib/integrations/mock/`. Registry: `lib/integrations/registry.ts`.

See [MOCK_INTEGRATIONS.md](./MOCK_INTEGRATIONS.md) and [INTEGRATION_ADAPTER_GUIDE.md](./INTEGRATION_ADAPTER_GUIDE.md).

## Observability & security

- Structured logger: `lib/observability/logger.ts` + `createRequestContext`
- Health: `GET /api/health` (Supabase + queue probe)
- Security headers: `lib/security/headers.ts` via `next.config.ts`
- API key rate limits: persistent `api_key_rate_limits`
- Internal cron rate limit: in-memory (`lib/security/rate-limit.ts`)
- Payload sanitization for admin display: `lib/jobs/sanitize-payload.ts`

## Sprint docs

[SPRINT_0](./SPRINT_0.md) … [SPRINT_10](./SPRINT_10.md). Ops: [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md). Perf: [PERFORMANCE.md](./PERFORMANCE.md). E2E: [E2E_MATRIX.md](./E2E_MATRIX.md).

UI must show **Modo demostración** (`DemoModeBadge`) on mock surfaces.
