import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authPaths } from "@/config/auth";
import { getUser } from "@/lib/auth/get-session";

function loginHrefForPath(pathname: string | null): string {
  if (!pathname || pathname === "/" || pathname.startsWith(authPaths.login)) {
    return authPaths.login;
  }
  if (
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/admin/login") ||
    pathname.startsWith("/_next")
  ) {
    return authPaths.login;
  }
  return `${authPaths.login}?next=${encodeURIComponent(pathname)}`;
}

export async function requireUser() {
  const user = await getUser();
  if (!user) {
    const pathname = (await headers()).get("x-pathname");
    redirect(loginHrefForPath(pathname));
  }
  return user;
}
