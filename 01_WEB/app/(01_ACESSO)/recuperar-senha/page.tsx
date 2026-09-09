import Link from "next/link";
import { requestPasswordReset } from "@/app/actions/auth";
import { SubmitButton } from "@/02_COMPONENTES_VISUAIS/submit-button";

export default async function RecoverPage({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string }> }) {
  const query = await searchParams;
  return (
    <div className="auth-card">
      <p className="eyebrow">RECUPERAÇÃO</p>
      <h1>Redefinir senha</h1>
      <p className="muted">Enviaremos um link seguro para o e-mail cadastrado.</p>
      {query.sent === "1" && <div className="alert success" role="status">Se o e-mail existir, o link foi enviado.</div>}
      {query.error && <div className="alert error" role="alert">Informe um e-mail válido.</div>}
      <form action={requestPasswordReset} className="form-stack">
        <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
        <SubmitButton pendingLabel="Enviando…">Enviar link</SubmitButton>
      </form>
      <Link className="text-link" href="/login">Voltar para entrar</Link>
    </div>
  );
}
