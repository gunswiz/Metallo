import Link from "next/link";
import { requestPasswordReset } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";

export default async function RecoverPage({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string }> }) {
  const query = await searchParams;
  return (
    <div className="auth-card">
      <p className="eyebrow">RECUPERAÇÃO</p>
      <h2>Redefinir senha</h2>
      <p className="muted">Enviaremos um link seguro para o e-mail cadastrado.</p>
      {query.sent === "1" && <div className="alert success">Se o e-mail existir, o link foi enviado.</div>}
      {query.error && <div className="alert error">Informe um e-mail válido.</div>}
      <form action={requestPasswordReset} className="form-stack">
        <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
        <SubmitButton pendingLabel="Enviando…">Enviar link</SubmitButton>
      </form>
      <Link className="text-link" href="/login">Voltar para o login</Link>
    </div>
  );
}
