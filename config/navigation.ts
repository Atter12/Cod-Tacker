export type NavigationItem = { label: string; href: string; permission?: string };

export const storeNavigation: NavigationItem[] = [
  { label: "Resumen", href: "" },
  { label: "Pedidos", href: "/orders" },
  { label: "Atribución", href: "/attribution" },
  { label: "Campañas", href: "/campaigns" },
  { label: "Logística", href: "/logistics" },
  { label: "RTO", href: "/rto" },
  { label: "Conciliación", href: "/reconciliation" },
  { label: "Automatizaciones", href: "/automations" },
  { label: "Alertas", href: "/alerts" },
  { label: "WhatsApp", href: "/whatsapp", permission: "whatsapp.view" },
  { label: "Integraciones", href: "/integrations" },
  { label: "Operaciones", href: "/operations" },
  { label: "Configuración", href: "/settings" },
];

export const agencyNavigation: NavigationItem[] = [
  { label: "Resumen", href: "/overview", permission: "agency.view" },
  { label: "Tiendas", href: "/stores", permission: "store.view" },
  { label: "Equipo", href: "/team", permission: "agency.team.view" },
  { label: "Marca", href: "/branding", permission: "branding.manage" },
  { label: "Facturación", href: "/billing", permission: "billing.view" },
  { label: "Claves API", href: "/api-keys", permission: "api_keys.view" },
];

export const adminNavigation: NavigationItem[] = [
  { label: "Resumen", href: "/admin" },
  { label: "Agencias", href: "/admin/agencies" },
  { label: "Tiendas", href: "/admin/stores" },
  { label: "Usuarios", href: "/admin/users" },
  { label: "Integraciones", href: "/admin/integrations" },
  { label: "Transportistas", href: "/admin/carriers" },
  { label: "Tareas", href: "/admin/jobs" },
  { label: "Webhooks", href: "/admin/webhooks" },
  { label: "Cola de errores", href: "/admin/dead-letter" },
  { label: "Auditoría", href: "/admin/audit" },
];
