const storeBase = (agencySlug: string, storeSlug: string) => `/a/${encodeURIComponent(agencySlug)}/s/${encodeURIComponent(storeSlug)}`;
const agencyBase = (agencySlug: string) => `/a/${encodeURIComponent(agencySlug)}`;
const adminBase = "/admin";
export const routes = {
  auth: { login: "/login", register: "/register", verifyOtp: "/verify-otp", forgotPassword: "/forgot-password", resetPassword: "/reset-password", accountSetup: "/account-setup" },
  app: { dashboard: "/dashboard", selectTenant: "/select-tenant", onboarding: "/onboarding" },
  store: { dashboard: (a: string, s: string) => storeBase(a, s), orders: (a: string, s: string) => `${storeBase(a, s)}/orders`, attribution: (a: string, s: string) => `${storeBase(a, s)}/attribution`, campaigns: (a: string, s: string) => `${storeBase(a, s)}/campaigns`, logistics: (a: string, s: string) => `${storeBase(a, s)}/logistics`, rto: (a: string, s: string) => `${storeBase(a, s)}/rto`, reconciliation: (a: string, s: string) => `${storeBase(a, s)}/reconciliation`, automations: (a: string, s: string) => `${storeBase(a, s)}/automations`, alerts: (a: string, s: string) => `${storeBase(a, s)}/alerts`, integrations: (a: string, s: string) => `${storeBase(a, s)}/integrations`, settings: (a: string, s: string) => `${storeBase(a, s)}/settings` },
  agency: { stores: (s: string) => `${agencyBase(s)}/stores`, team: (s: string) => `${agencyBase(s)}/team`, branding: (s: string) => `${agencyBase(s)}/branding`, billing: (s: string) => `${agencyBase(s)}/billing`, apiKeys: (s: string) => `${agencyBase(s)}/api-keys` },
  admin: { login: `${adminBase}/login`, overview: adminBase, agencies: `${adminBase}/agencies`, stores: `${adminBase}/stores`, users: `${adminBase}/users`, integrations: `${adminBase}/integrations`, carriers: `${adminBase}/carriers`, jobs: `${adminBase}/jobs`, webhooks: `${adminBase}/webhooks`, deadLetter: `${adminBase}/dead-letter`, audit: `${adminBase}/audit` },
} as const;
