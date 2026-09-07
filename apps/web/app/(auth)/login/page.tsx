import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn } from "@/app/actions/auth";
import { getSessionProfile } from "@/lib/auth/session";
import { SubmitButton } from "@/components/submit-button";

export const metadata: Metadata = { title: "Entrar" };

const messages: Record<string, string> = {
  "dados-invalidos": "Revise o e-mail e a senha informados.",
  "credenciais-invalidas": "E-mail ou senha inválidos.",
  callback: "O link de acesso não pôde ser validado.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const profile = await getSessionProfile();
  if (profile?.active) redirect("/dashboard");
  const { error } = await searchParams;
  return (
    <div className="auth-card">
      <p className="eyebrow">BEM-VINDO</p>
      <h1>Acesse o Metallo</h1>
      <p className="muted">Use as mesmas credenciais do aplicativo móvel.</p>
      {error && <div className="alert error" role="alert">{messages[error] ?? "Não foi possível entrar."}</div>}
      <form action={signIn} className="form-stack">
        <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
        <label>Senha<input name="password" type="password" autoComplete="current-password" minLength={8} required /></label>
        <SubmitButton pendingLabel="Entrando…">Entrar</SubmitButton>
      </form>
      <Link className="text-link" href="/recuperar-senha">Esqueci minha senha</Link>
    </div>
  );
}
