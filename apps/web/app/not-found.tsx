import Link from "next/link";

export default function NotFound() {
  return (
    <main className="state-page">
      <span className="state-code">404</span>
      <h1>Página não encontrada</h1>
      <p>O endereço pode ter mudado ou o registro não está disponível.</p>
      <Link className="button secondary" href="/dashboard">Ir ao dashboard</Link>
    </main>
  );
}
