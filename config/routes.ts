const storeBase = (agencySlug: string, storeSlug: string) => `/a/${encodeURIComponent(agencySlug)}/s/${encodeURIComponent(storeSlug)}`;
const agencyBase = (agencySlug: string) => `/a/${encodeURIComponent(agencySlug)}`;
const adminBase = "/admin";
export const routes = {
  auth: {
    login: "/login",
    register: "/register",
    verifyOtp: "/verify-otp",
    forgotPassword: "/forgot-password",
    resetPassword: "/reset-password",
    accountSetup: "/account-setup",
    callback: "/auth/callback",
  },
  app: { dashboard: "/dashboard", onboarding: "/onboarding", profile: "/profile", invitesAccept: "/invites/accept" },
  store: {
    dashboard: (a: string, s: string) => `${storeBase(a, s)}/dashboard`,
    orders: (a: string, s: string) => `${storeBase(a, s)}/orders`,
    orderDetail: (a: string, s: string, orderId: string) =>
      `${storeBase(a, s)}/orders/${encodeURIComponent(orderId)}`,
    attribution: (a: string, s: string) => `${storeBase(a, s)}/attribution`,
    attributionAccount: (a: string, s: string, accountId: string) =>
      `${storeBase(a, s)}/attribution/accounts/${encodeURIComponent(accountId)}`,
    campaigns: (a: string, s: string) => `${storeBase(a, s)}/campaigns`,
    campaignDetail: (a: string, s: string, campaignId: string) =>
      `${storeBase(a, s)}/campaigns/${encodeURIComponent(campaignId)}`,
    adSetDetail: (a: string, s: string, campaignId: string, adSetId: string) =>
      `${storeBase(a, s)}/campaigns/${encodeURIComponent(campaignId)}/adsets/${encodeURIComponent(adSetId)}`,
    adDetail: (a: string, s: string, adId: string) =>
      `${storeBase(a, s)}/ads/${encodeURIComponent(adId)}`,
    logistics: (a: string, s: string) => `${storeBase(a, s)}/logistics`,
    shipmentDetail: (a: string, s: string, shipmentId: string) =>
      `${storeBase(a, s)}/logistics/${encodeURIComponent(shipmentId)}`,
    rto: (a: string, s: string) => `${storeBase(a, s)}/rto`,
    rtoGeography: (a: string, s: string) => `${storeBase(a, s)}/rto/geography`,
    rtoProducts: (a: string, s: string) => `${storeBase(a, s)}/rto/products`,
    rtoCampaigns: (a: string, s: string) => `${storeBase(a, s)}/rto/campaigns`,
    reconciliation: (a: string, s: string) => `${storeBase(a, s)}/reconciliation`,
    reconciliationImport: (a: string, s: string) => `${storeBase(a, s)}/reconciliation/import`,
    reconciliationBatch: (a: string, s: string, batchId: string) =>
      `${storeBase(a, s)}/reconciliation/${encodeURIComponent(batchId)}`,
    reconciliationDiscrepancies: (a: string, s: string) =>
      `${storeBase(a, s)}/reconciliation/discrepancies`,
    automations: (a: string, s: string) => `${storeBase(a, s)}/automations`,
    automationNew: (a: string, s: string) => `${storeBase(a, s)}/automations/new`,
    automationDetail: (a: string, s: string, ruleId: string) =>
      `${storeBase(a, s)}/automations/${encodeURIComponent(ruleId)}`,
    automationEdit: (a: string, s: string, ruleId: string) =>
      `${storeBase(a, s)}/automations/${encodeURIComponent(ruleId)}/edit`,
    automationRuns: (a: string, s: string, ruleId: string) =>
      `${storeBase(a, s)}/automations/${encodeURIComponent(ruleId)}/runs`,
    automationRunDetail: (a: string, s: string, ruleId: string, runId: string) =>
      `${storeBase(a, s)}/automations/${encodeURIComponent(ruleId)}/runs/${encodeURIComponent(runId)}`,
    alerts: (a: string, s: string) => `${storeBase(a, s)}/alerts`,
    alertDetail: (a: string, s: string, alertId: string) =>
      `${storeBase(a, s)}/alerts/${encodeURIComponent(alertId)}`,
    whatsapp: (a: string, s: string) => `${storeBase(a, s)}/whatsapp`,
    whatsappConversation: (a: string, s: string, conversationId: string) =>
      `${storeBase(a, s)}/whatsapp/conversations/${encodeURIComponent(conversationId)}`,
    whatsappTemplates: (a: string, s: string) => `${storeBase(a, s)}/whatsapp/templates`,
    integrations: (a: string, s: string) => `${storeBase(a, s)}/integrations`,
    integrationDetail: (a: string, s: string, provider: string) =>
      `${storeBase(a, s)}/integrations/${encodeURIComponent(provider)}`,
    operations: (a: string, s: string) => `${storeBase(a, s)}/operations`,
    syncRunDetail: (a: string, s: string, runId: string) =>
      `${storeBase(a, s)}/operations/sync-runs/${encodeURIComponent(runId)}`,
    settings: (a: string, s: string) => `${storeBase(a, s)}/settings`,
  },
  agency: {
    overview: (s: string) => `${agencyBase(s)}/overview`,
    stores: (s: string) => `${agencyBase(s)}/stores`,
    team: (s: string) => `${agencyBase(s)}/team`,
    branding: (s: string) => `${agencyBase(s)}/branding`,
    billing: (s: string) => `${agencyBase(s)}/billing`,
    apiKeys: (s: string) => `${agencyBase(s)}/api-keys`,
  },
  admin: {
    login: `${adminBase}/login`,
    overview: adminBase,
    agencies: `${adminBase}/agencies`,
    agencyDetail: (agencyId: string) => `${adminBase}/agencies/${encodeURIComponent(agencyId)}`,
    stores: `${adminBase}/stores`,
    storeDetail: (storeId: string) => `${adminBase}/stores/${encodeURIComponent(storeId)}`,
    users: `${adminBase}/users`,
    userDetail: (userId: string) => `${adminBase}/users/${encodeURIComponent(userId)}`,
    integrations: `${adminBase}/integrations`,
    carriers: `${adminBase}/carriers`,
    carrierDetail: (carrierId: string) => `${adminBase}/carriers/${encodeURIComponent(carrierId)}`,
    carrierMappings: (carrierId: string) =>
      `${adminBase}/carriers/${encodeURIComponent(carrierId)}/mappings`,
    jobs: `${adminBase}/jobs`,
    jobDetail: (jobId: string) => `${adminBase}/jobs/${encodeURIComponent(jobId)}`,
    webhooks: `${adminBase}/webhooks`,
    webhookDetail: (eventId: string) => `${adminBase}/webhooks/${encodeURIComponent(eventId)}`,
    deadLetter: `${adminBase}/dead-letter`,
    deadLetterDetail: (id: string) => `${adminBase}/dead-letter/${encodeURIComponent(id)}`,
    audit: `${adminBase}/audit`,
  },
} as const;
