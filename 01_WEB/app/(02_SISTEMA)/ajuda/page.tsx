import Link from "next/link";
import { can } from "@metallo/core";
import { requireProfile } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
export default async function HelpPage() {
  const profile = await requireProfile();
  // Marco 3K: guia segue o menu novo (Lançar, Estoque, Pedidos, Pessoas).
  const guides = [
    { title: "Lançar o dia a dia", href: "/lancar", text: "Em Lançar, escolha a ação: registrar consumo, receber material ou EPI, entregar EPI, pedir à ADM, transferir ou dar baixa, mover equipamento. Cada uma abre uma tela curta. Ajuste \"Quando aconteceu\" se estiver lançando depois. Sem internet, o lançamento fica guardado e é enviado quando a conexão voltar." },
    { title: "Ver o estoque das obras", href: "/estoque", text: "Estoque das obras mostra quanto tem de cada material e EPI em cada obra ou local. Use a busca para achar um item." },
    { title: "Pedidos à ADM", href: "/pedidos-adm", text: "Acompanhe as compras pedidas pelas obras em Em andamento e Concluídos. Quando a compra chegar, use Lançar › Receber material ou EPI." },
    { title: "Máquinas alugadas", href: "/locacoes", text: "Confira a locadora, a numeração e a equipe. Quando não precisar mais, avise a ADM pela própria máquina. A ADM registra a devolução e confirma separadamente o encerramento da cobrança." },
    { title: "Histórico de movimentações", href: "/movimentacoes", text: "Tudo o que entrou, saiu ou mudou de lugar, com data e responsável. Abra um registro para corrigir, se tiver permissão." },
    { title: "Acompanhar consumo", href: "/consumo", text: "Escolha o período e a equipe. Compare categorias, materiais e evolução. As quantidades são separadas por unidade." },
    { title: "Relatórios", href: "/relatorios", text: "Use o período e a equipe para localizar entradas, saídas e entregas, e gerar o PDF de EPI." },
  ];
  if (can(profile, "epi:read")) guides.push({ title: "PDF individual de EPI", href: "/funcionarios?guia=pdf", text: "Abra Funcionários, selecione a pessoa e use PDF individual de EPI para assinatura. A ficha reúne as entregas com C.A., quantidade e espaço para assinar." });
  if (can(profile, "admin:manage")) guides.push({ title: "Definir permissões e equipes", href: "/usuarios", text: "Em Criar acesso ou Editar usuário, escolha quais operações a pessoa pode executar e em quais equipes. A permissão de EPI não transforma o responsável em administrador." }, { title: "Estoque único e alertas da ADM", href: "/obras?section=works", text: "Cadastre a obra com a equipe que guarda o estoque e vincule as outras equipes. Os saldos são somados com histórico. Use a aba Alertas para acompanhar pedidos, estoque, EPI e locações." });
  if (can(profile, "epi:read")) guides.push({ title: "Kit e pendências do funcionário", href: "/funcionarios", text: "Abra o funcionário e depois Kit e itens faltantes. Confira o previsto, o que está em uso e as solicitações pendentes. A COSEM atende escolhendo um lote compatível." });
  if (can(profile, "epi:write")) guides.push({ title: "Entregar vários itens", href: "/epis/entrega-em-lote", text: "Escolha o funcionário, adicione os lotes e as quantidades à lista, revise e confirme. Os itens são registrados juntos." });
  return <><PageHeader eyebrow="GUIA DO METALLO" title="Guia de uso" description="Como fazer as rotinas do dia a dia. Abrir uma área não altera dados." />
    <section className="content-grid">{guides.map((guide) => <article className="panel" key={guide.href}><header className="panel-header"><h2>{guide.title}</h2></header><div className="panel-body"><p>{guide.text}</p><Link className="button secondary" href={guide.href}>Abrir área</Link></div></article>)}</section></>;
}
