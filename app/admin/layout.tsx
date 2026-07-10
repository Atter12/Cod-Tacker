import { type ReactNode } from "react";

/**
 * Login is public so a nested `(platform)` layout owns the server-side guard
 * and shell for every other `/admin` route.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
