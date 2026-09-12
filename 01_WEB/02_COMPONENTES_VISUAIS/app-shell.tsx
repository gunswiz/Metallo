import { Bell, LogOut, Search } from "lucide-react";
import Link from "next/link";
import { roleLabels } from "@metallo/core";
import type { SessionProfile } from "@metallo/types";
import { signOut } from "@/app/actions/auth";
import { Brand } from "@/02_COMPONENTES_VISUAIS/brand";
import { SidebarNav } from "@/02_COMPONENTES_VISUAIS/sidebar-nav";
import { RealtimeRefresh } from "@/02_COMPONENTES_VISUAIS/realtime-refresh";
import { version } from "@/package.json";
import { ModuleTheme } from "./module-theme";

export function AppShell({ profile, children }: { profile: SessionProfile; children: React.ReactNode }) {
  const initials = profile.fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Brand />
        <SidebarNav profile={profile} />
        <div className="sidebar-footer">
          <span className="avatar">{initials}</span>
          <span className="user-summary">
            <strong>{profile.fullName}</strong>
            <small>{roleLabels[profile.role]}</small>
            <small>Metallo {version}</small>
          </span>
          <form action={signOut}>
            <button className="icon-button" type="submit" title="Sair" aria-label="Sair">
              <LogOut size={18} />
            </button>
          </form>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-search">
            <Search size={17} aria-hidden />
            <span>Pesquise dentro de cada módulo</span>
          </div>
          {profile.role === 'admin' && <Link className="icon-button" href="/obras?section=alerts" aria-label="Alertas da ADM" title="Alertas da ADM">
            <Bell size={19} />
          </Link>}
          <span className="topbar-avatar">{initials}</span>
        </header>
        <ModuleTheme>{children}</ModuleTheme>
      </div>
      <RealtimeRefresh enabled />
    </div>
  );
}
