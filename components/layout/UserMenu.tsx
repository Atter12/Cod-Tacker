"use client";

import { useRouter } from "next/navigation";
import { LogOut, Moon, Sun, User } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { routes } from "@/config/routes";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { toggleTheme } from "./ThemeProvider";

export function UserMenu({ name = "Usuario", email }: { name?: string; email?: string }) {
  const router = useRouter();

  return (
    <Dropdown
      trigger={
        <span className="grid size-8 place-items-center rounded-full bg-brand-primary text-xs font-semibold text-white">
          {(name || email || "U").slice(0, 1).toUpperCase()}
        </span>
      }
    >
      <div className="border-b border-border px-3 py-2">
        <p className="text-sm font-medium">{name}</p>
        {email ? <p className="text-xs text-text-secondary">{email}</p> : null}
      </div>
      <DropdownItem onClick={() => router.push(routes.app.profile)}>
        <span className="flex items-center gap-2">
          <User className="size-4" />
          Perfil
        </span>
      </DropdownItem>
      <DropdownItem onClick={toggleTheme}>
        <span className="flex items-center gap-2">
          <Sun className="size-4 dark:hidden" />
          <Moon className="hidden size-4 dark:block" />
          Cambiar tema
        </span>
      </DropdownItem>
      <DropdownItem
        onClick={() => {
          void logout();
        }}
      >
        <span className="flex items-center gap-2 text-danger">
          <LogOut className="size-4" />
          Cerrar sesión
        </span>
      </DropdownItem>
    </Dropdown>
  );
}
