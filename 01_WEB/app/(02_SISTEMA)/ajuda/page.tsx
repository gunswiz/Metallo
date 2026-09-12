import Link from "next/link";
import { can } from "@metallo/core";
import { requireProfile } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
export default async function HelpPage() {
  const profile = await requireProfile();
  const guides = [
    { title: "Obras, compras e recebimentos", href: "/obras", text: "Em Obras e pedidos, registre consumo, compras entregues na obra e entregas de EPI. Pedidos e recebimentos mostra o que foi solicitado, o que chegou e o que ainda falta. Ajuste Quando aconteceu se estiver lançando depois." },
    { title: "Máquinas alugadas", href: "/obras?section=rentals", text: "Confira a locadora, a numeração e a equipe. Quando não precisar mais, avise a ADM pela própria máquina. A ADM registra a devolução e confirma separadamente o encerramento da cobrança." },
    { title: "Consultar o almoxarifado", href: "/almoxarifado", text: "Escolha Materiais, Equipamentos, Ferramentas ou EPIs. Abra um item para ver seus detalhes e histórico." },
    { title: "Registrar movimentações", href: "/movimentacoes", text: "Abra Nova movimentação. Escolha o item, origem, destino e quantidade. Confira os dados antes de confirmar." },
    { title: "Acompanhar consumo", href: "/consumo", text: "Escolha o período e a equipe. Compare categorias, materiais e evolução. As quantidades são separadas por unidade." },
    { title: "Investigar o histórico", href: "/relatorios", text: "Use o período e a equipe para localizar entradas, saídas e entregas. Os relatórios mostram os registros que formam os resultados." },
  ];
  if (can(profile, "epi:read")) guides.push({ title: "PDF individual de EPI", href: "/funcionarios?guia=pdf", text: "Abra Funcionários, selecione a pessoa e use PDF individual de EPI para assinatura. A ficha reúne as entregas com C.A., quantidade e espaço para assinar." });
  if (can(profile, "admin:manage")) guides.push({ title: "Definir permissões e equipes", href: "/usuarios", text: "Em Criar acesso ou Editar usuário, escolha quais operações a pessoa pode executar e em quais equipes. A permissão de EPI não transforma o responsável em administrador." }, { title: "Estoque único e alertas da ADM", href: "/obras?section=works", text: "Cadastre a obra com a equipe que guarda o estoque e vincule as outras equipes. Os saldos são somados com histórico. Use a aba Alertas para acompanhar pedidos, estoque, EPI e locações." });
  if (can(profile, "epi:read")) guides.push({ title: "Kit e pendências do funcionário", href: "/funcionarios", text: "Abra o funcionário e depois Kit e itens faltantes. Confira o previsto, o que está em uso e as solicitações pendentes. A COSEM atende escolhendo um lote compatível." });
  if (can(profile, "epi:write")) guides.push({ title: "Entregar vários itens", href: "/epis/entrega-em-lote", text: "Escolha o funcionário, adicione os lotes e as quantidades à lista, revise e confirme. Os itens são registrados juntos." });
  return <><PageHeader eyebrow="GUIA DO METALLO" title="Como usar o Web" description="Orientações para as mesmas rotinas do aplicativo, adaptadas ao navegador. Abrir uma área não altera dados." />
    <section className="content-grid">{guides.map((guide) => <article className="panel" key={guide.href}><header className="panel-header"><h2>{guide.title}</h2></header><div className="panel-body"><p>{guide.text}</p><Link className="button secondary" href={guide.href}>Abrir área</Link></div></article>)}</section></>;
}
