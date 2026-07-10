import { NextResponse } from "next/server";
import { validateRedirectPath } from "@/config/auth";
import { routes } from "@/config/routes";
import { createClient } from "@/lib/supabase/server";

/**
 * Exchanges a Supabase auth `code` (PKCE) for a session cookie.
 * Used by password-recovery and email confirmation links.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = validateRedirectPath(searchParams.get("next"), routes.app.dashboard);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL(`${routes.auth.login}?error=auth_callback`, origin));
}
