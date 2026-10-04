import Link from "next/link";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { ICONES } from "@/02_COMPONENTES_VISUAIS/icones-menu";
import { requireProfile } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { ACOES_LANCAR } from "@/09_CONFIGURACOES/navegacao-gestao";

export default async function LancarPage() {
  const profile = await requireProfile();
  const acoes = ACOES_LANCAR.filter(acao => acao.pode(profile));
  return <><PageHeader eyebrow="DIA A DIA" title="O que você quer lançar?" description="Escolha uma ação. Cada uma abre uma tela curta, com a data do fato e envio garantido mesmo sem internet."/>
    {acoes.length === 0 ? <p className="muted">Seu acesso é só de consulta. Peça à ADM se precisar lançar algo.</p> :
      <nav className="quick-grid" aria-label="Ações de lançamento">{acoes.map(acao => {
        const Icon = ICONES[acao.icone] ?? ICONES.outros;
        return <Link key={acao.slug} className="quick-card" href={`/lancar/${acao.slug}`}><Icon size={30} aria-hidden/><span><strong>{acao.label}</strong><small>{acao.dica}</small></span></Link>;
      })}</nav>}
  </>;
}
