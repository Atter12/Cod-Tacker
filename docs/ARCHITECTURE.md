# Architecture

CODTracked is a Next.js App Router application backed by Supabase. Route components are server components by default; client interactivity is isolated in reusable UI components.

## Layers

- `app/`: routes, layouts, and server actions.
- `components/`: reusable presentation components and application shells.
- `services/`: typed query/use-case functions using the caller's Supabase client.
- `lib/`: Supabase clients, authentication guards, validation, and shared utilities.
- `config/`: routes, navigation, environment validation, permissions, and site settings.
- `types/`: generated Supabase database contract plus domain types.

## Routing and tenancy

Tenant routes use `/a/:agencySlug` and `/a/:agencySlug/s/:storeSlug`. The platform console is `/admin`; `/admin/login` is public while its other routes are protected by the nested platform layout.

The admin console uses the request-scoped authenticated client. It does not use the service role for UI reads, so database RLS remains authoritative.
