"use client";

import { useEffect } from "react";

const storageKey = "codtracked-theme";

export function applyTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const savedTheme = window.localStorage.getItem(storageKey);
    const theme =
      savedTheme === "light" || savedTheme === "dark"
        ? savedTheme
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    applyTheme(theme);
  }, []);

  return children;
}

export function toggleTheme() {
  const nextTheme = document.documentElement.classList.contains("dark")
    ? "light"
    : "dark";
  window.localStorage.setItem(storageKey, nextTheme);
  applyTheme(nextTheme);
}
