export const authPaths = {
  login: "/login",
  register: "/register",
  verifyOtp: "/verify-otp",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  accountSetup: "/account-setup",
  onboarding: "/onboarding",
} as const;
export const authCookieNames = { tenant: "codtracked-tenant" } as const;
export function validateRedirectPath(path: string | null | undefined, fallback = "/dashboard"): string { return path && path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") ? path : fallback; }
export function isAllowedRedirectPath(path: string | null | undefined): path is string { return validateRedirectPath(path, "") === path; }
