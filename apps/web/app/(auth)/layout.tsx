import { Brand } from "@/components/brand";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <Brand />
        <div>
          <p className="eyebrow">OPERAÇÃO CONECTADA</p>
          <h1>Controle industrial com rastreabilidade real.</h1>
          <p>O mesmo estoque, equipes e histórico usados pelo aplicativo Metallo em campo.</p>
        </div>
        <small>Metallo Web · Centro administrativo</small>
      </section>
      <section className="auth-form-panel">{children}</section>
    </main>
  );
}
