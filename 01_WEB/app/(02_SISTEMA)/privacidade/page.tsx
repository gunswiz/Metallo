import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { requireProfile } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { AVISO_LGPD, DEVERES_GESTAO, VERSAO_AVISO_LGPD } from "@/03_FUNCOES_E_LOGICA/Privacidade/aviso-lgpd";

// Marco 3S — Aviso de privacidade (LGPD) na Gestão, com os deveres de quem usa o sistema.
export default async function PrivacidadePage() {
  await requireProfile();
  return <>
    <PageHeader eyebrow="LGPD" title="Privacidade e proteção de dados"
      description="Como o Metallo usa os dados dos funcionários e o que cada usuário da Gestão precisa cuidar." />
    <section className="panel privacidade"><div className="panel-body">
      <div className="alert warn" role="note">Texto-base em teste (versão {VERSAO_AVISO_LGPD}). Precisa ser revisado pelo jurídico e pelo encarregado de dados da empresa antes do uso real.</div>
      <h2>Seus deveres ao usar a Gestão</h2>
      <ul>{DEVERES_GESTAO.map(d => <li key={d}>{d}</li>)}</ul>
      <h2>O que o funcionário vê no aplicativo</h2>
      {AVISO_LGPD.map(s => <section key={s.titulo}><h3>{s.titulo}</h3><ul>{s.itens.map(i => <li key={i}>{i}</li>)}</ul></section>)}
    </div></section>
  </>;
}
