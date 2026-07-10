import { getPublicEnv } from "@/config/env";
export const siteConfig = { name: "CODTracked", description: "Plataforma para operar y optimizar ventas contra entrega.", get locale() { return getPublicEnv().NEXT_PUBLIC_DEFAULT_LOCALE; }, get timezone() { return getPublicEnv().NEXT_PUBLIC_DEFAULT_TIMEZONE; } } as const;
