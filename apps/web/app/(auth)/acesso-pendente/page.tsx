import { signOut } from "@/app/actions/auth";

export default function PendingAccessPage() {
  return (
    <div className="auth-card">
      <p className="eyebrow">ACESSO PENDENTE</p>
      <h2>Seu cadastro aguarda liberação</h2>
      <p className="muted">Um administrador precisa ativar o perfil e definir as permissões antes do acesso.</p>
      <form action={signOut}><button className="button secondary" type="submit">Sair</button></form>
    </div>
  );
}
