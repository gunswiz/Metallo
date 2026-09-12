"use client";
import { usePathname } from "next/navigation";
export function ModuleTheme({ children }: { children: React.ReactNode }) {
  const path = usePathname().split("/")[1];
  return (
    <main className="page-content" data-module={path}>
      {children}
    </main>
  );
}
