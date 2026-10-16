"use client";
import { usePathname } from "next/navigation";
import { GRUPOS_MENU, ativo } from "@/09_CONFIGURACOES/navegacao-gestao";
export function ModuleBreadcrumb() {
  const path = usePathname();
  const item = GRUPOS_MENU.flatMap(group => group.itens).find(item => ativo(path, item.href));
  return <div className="redesign-crumb">Metallo Gestão <span aria-hidden="true">/</span><strong>{item?.label ?? "Minha operação"}</strong></div>;
}
export function ModuleTheme({ children }: { children: React.ReactNode }) {
  const path = usePathname().split("/")[1];
  return (
    <main className="page-content" data-module={path}>
      {children}
    </main>
  );
}
