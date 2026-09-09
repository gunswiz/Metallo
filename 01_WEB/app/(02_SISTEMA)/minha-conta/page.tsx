import Link from "next/link";
import { roleLabels } from "@metallo/core";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { OperationForm } from "@/02_COMPONENTES_VISUAIS/formulario-operacao";
import { requireProfile } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { createClient } from "@/05_ACESSO_A_DADOS/Supabase/server";
import { changeMyEmail } from "@/app/actions/minha-conta";
export default async function MyAccountPage({ searchParams }: { searchParams: Promise<{ confirmation?: string }> }) {
  const profile = await requireProfile();
  const { data, error } = await (await createClient()).auth.getUser();
  if (error || !data.user) throw new Error("Não foi possível carregar sua conta.");
  const query = await searchParams;
  return <><PageHeader eyebrow="MEU ACESSO" title="Minha conta" description={`${profile.fullName} · ${roleLabels[profile.role]}`} />
    {query.confirmation && <div className="alert success" role="status">Solicitação recebida. Confira as mensagens de confirmação no e-mail atual e no novo endereço, conforme as configurações da sua conta.</div>}
    <section className="panel"><header className="panel-header"><h2>E-mail de acesso</h2></header><div className="panel-body"><p>Endereço atual: {data.user.email}</p><OperationForm action={changeMyEmail} label="Solicitar alteração de e-mail">
      <label>Novo e-mail<input name="email" type="email" required autoComplete="email" /></label><label>Confirme o novo e-mail<input name="confirmation" type="email" required autoComplete="off" /></label>
    </OperationForm></div></section>
    <section className="panel"><header className="panel-header"><h2>Senha e ajuda</h2></header><div className="panel-body"><Link className="button secondary" href="/atualizar-senha">Alterar minha senha</Link> <Link className="button ghost" href="/ajuda">Guia do Metallo</Link></div></section>
  </>;
}
