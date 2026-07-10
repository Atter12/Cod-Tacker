# CODTracked

CODTracked centraliza analítica y operación para comercios de e-commerce contra entrega. Está construido con Next.js App Router y Supabase, con aislamiento multi-tenant mediante Row Level Security (RLS).

## Funcionalidades actuales

- Rutas multi-tenant para agencias y tiendas.
- Autenticación mediante Supabase.
- Panel de administración de plataforma en `/admin`.
- Consultas administrativas que respetan el cliente autenticado y las políticas RLS.
- Script de verificación de aislamiento entre dos tenants.

Las integraciones de Shopify, Meta, TikTok, WhatsApp, transportistas y workers aún no están implementadas. Consulta el [roadmap](docs/ROADMAP.md).

## Inicio rápido

Requiere Node.js 24 y un proyecto Supabase.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Completa las variables de `.env.local` antes de iniciar. Consulta la [guía de configuración](docs/DEVELOPMENT_SETUP.md).

## Scripts

```bash
npm run dev        # servidor de desarrollo
npm run lint       # reglas de ESLint
npm run typecheck  # comprobación de tipos
npm run build      # build de producción
npm run test:rls   # prueba aislamiento de tenants con usuarios reales
```

`test:rls` requiere usuarios y tenants de prueba; no utiliza la service role. Sigue [RLS_TESTING.md](docs/RLS_TESTING.md) y [SEED_DATA.md](docs/SEED_DATA.md).

## Documentación

- [Arquitectura](docs/ARCHITECTURE.md)
- [Autenticación y tenancy](docs/AUTH_AND_TENANCY.md)
- [Variables de entorno](docs/ENVIRONMENT_VARIABLES.md)
- [Pruebas RLS](docs/RLS_TESTING.md)
- [Datos de prueba](docs/SEED_DATA.md)
- [Configuración de desarrollo](docs/DEVELOPMENT_SETUP.md)
- [Roadmap](docs/ROADMAP.md)
