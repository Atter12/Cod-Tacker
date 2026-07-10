"use client";

import { LogOut, Moon, Sun, User } from "lucide-react";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { toggleTheme } from "./ThemeProvider";
export function UserMenu({ name = "Usuario", email, onLogout }: { name?: string; email?: string; onLogout?: () => void }) {
  return <Dropdown trigger={<span className="grid size-8 place-items-center rounded-full bg-brand-primary text-xs font-semibold text-white">{name.slice(0, 1).toUpperCase()}</span>}><div className="border-b border-border px-3 py-2"><p className="text-sm font-medium">{name}</p>{email && <p className="text-xs text-text-secondary">{email}</p>}</div><DropdownItem><span className="flex items-center gap-2"><User className="size-4" />Perfil</span></DropdownItem><DropdownItem onClick={toggleTheme}><span className="flex items-center gap-2"><Sun className="size-4 dark:hidden" /><Moon className="hidden size-4 dark:block" />Cambiar tema</span></DropdownItem><DropdownItem onClick={onLogout}><span className="flex items-center gap-2 text-danger"><LogOut className="size-4" />Cerrar sesión</span></DropdownItem></Dropdown>;
}
