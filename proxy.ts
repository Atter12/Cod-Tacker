import { NextResponse, type NextRequest } from "next/server";
import { decideHostGate, readHostSplitOrigins } from "@/lib/hosts/host-gate";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const origins = readHostSplitOrigins();
  const decision = decideHostGate({
    host: request.nextUrl.host,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    shopifyAppUrl: origins.shopifyAppUrl,
    productAppUrl: origins.productAppUrl,
  });
  if (decision.kind === "redirect") {
    return NextResponse.redirect(decision.location, 307);
  }
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
