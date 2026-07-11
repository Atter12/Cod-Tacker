import { LogOut } from "lucide-react";
import { logout } from "@/app/actions/auth";

export function StoreSelectorLogout() {
  return (
    <form action={logout} className="mt-4">
      <button
        type="submit"
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[11px] border border-[rgba(76,139,170,0.3)] bg-[#0A1729] text-sm font-medium text-[#E2E8F0] transition-colors duration-150 hover:border-[rgba(248,113,113,0.35)] hover:text-[#FCA5A5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(34,211,238,0.45)]"
      >
        <LogOut className="size-4" aria-hidden />
        Cerrar sesión
      </button>
    </form>
  );
}
