import { AppShell } from "@/02_COMPONENTES_VISUAIS/app-shell";
import { requireProfile } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";

export default async function PlatformLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const profile = await requireProfile();
  return <AppShell profile={profile}>{children}</AppShell>;
}
