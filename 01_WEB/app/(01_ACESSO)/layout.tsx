import { Brand } from "@/02_COMPONENTES_VISUAIS/brand";
import { headers } from "next/headers";
import { LoginGalpao } from "@/02_COMPONENTES_VISUAIS/Galpao/login-galpao";
import { destinoLoginTeste, redesignTesteLiberado } from "@/09_CONFIGURACOES/ambiente-teste-online";

export default async function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (redesignTesteLiberado(process.env)) {
    const local = /^(127\.0\.0\.1|localhost):3102$/.test((await headers()).get("host") ?? "");
    return <main><div className="redesign-test-banner">Ambiente de teste · Metallo Gestão</div><LoginGalpao area="gestao" outroAcesso={destinoLoginTeste("colaborador", local)}>{children}</LoginGalpao></main>;
  }
  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <Brand />
        <div>
          <p className="eyebrow">OPERAÇÃO CONECTADA</p>
          <h1>Controle industrial com rastreio real.</h1>
          <p>O mesmo estoque, equipes e histórico usados pelo aplicativo Metallo em campo.</p>
        </div>
        <small>Metallo Web · Centro administrativo</small>
      </section>
      <section className="auth-form-panel">{children}</section>
    </main>
  );
}
