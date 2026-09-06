import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <section className="state-page">
      <span className="state-code">403</span>
      <h1>Acesso não autorizado</h1>
      <p>Seu perfil não possui permissão para este módulo.</p>
      <Link className="button secondary" href="/dashboard">Voltar ao dashboard</Link>
    </section>
  );
}
