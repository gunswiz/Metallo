import { updatePassword } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";

export default async function UpdatePasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="auth-card">
      <p className="eyebrow">NOVA SENHA</p>
      <h1>Proteja sua conta</h1>
      {error && <div className="alert error" role="alert">Não foi possível alterar. Confirme as duas senhas.</div>}
      <form action={updatePassword} className="form-stack">
        <label>Nova senha<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
        <label>Confirmar senha<input name="confirmation" type="password" autoComplete="new-password" minLength={8} required /></label>
        <SubmitButton pendingLabel="Salvando…">Salvar nova senha</SubmitButton>
      </form>
    </div>
  );
}
