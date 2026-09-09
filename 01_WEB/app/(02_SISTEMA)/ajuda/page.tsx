import Link from "next/link";
import { can } from "@metallo/core";
import { requireProfile } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
export default async function HelpPage() {
  const profile = await requireProfile();
  const guides = [
    { title: "Consultar o almoxarifado", href: "/almoxarifado", text: "Escolha Materiais, Equipamentos, Ferramentas ou EPIs. Abra um item para ver seus detalhes e histórico." },
    { title: "Registrar movimentações", href: "/movimentacoes", text: "Abra Nova movimentação. Escolha o item, origem, destino e quantidade. Confira os dados antes de confirmar." },
    { title: "Acompanhar consumo", href: "/consumo", text: "Escolha o período e a equipe. Compare categorias, materiais e evolução. As quantidades são separadas por unidade." },
    { title: "Investigar o histórico", href: "/relatorios", text: "Use o período e a equipe para localizar entradas, saídas e entregas. Os relatórios mostram os registros que formam os resultados." },
  ];
  if (can(profile.role, "epi:read")) guides.push({ title: "Kit e pendências do funcionário", href: "/funcionarios", text: "Abra o funcionário e depois Kit e itens faltantes. Confira o previsto, o que está em uso e as solicitações pendentes. A COSEM atende escolhendo um lote compatível." });
  if (can(profile.role, "epi:write")) guides.push({ title: "Entregar vários itens", href: "/epis/entrega-em-lote", text: "Escolha o funcionário, adicione os lotes e as quantidades à lista, revise e confirme. Os itens são registrados juntos." });
  return <><PageHeader eyebrow="GUIA DO METALLO" title="Como usar o Web" description="Orientações para as mesmas rotinas do aplicativo, adaptadas ao navegador. Abrir uma área não altera dados." />
    <section className="content-grid">{guides.map((guide) => <article className="panel" key={guide.href}><header className="panel-header"><h2>{guide.title}</h2></header><div className="panel-body"><p>{guide.text}</p><Link className="button secondary" href={guide.href}>Abrir área</Link></div></article>)}</section></>;
}
