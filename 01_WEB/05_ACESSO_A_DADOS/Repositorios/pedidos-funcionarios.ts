import { getEpiOperations } from "@/05_ACESSO_A_DADOS/Repositorios/epi-operacoes-repository";
import { readAdminPersonalItems3g } from "@/05_ACESSO_A_DADOS/Supabase/itens-pessoais-3g";
import { lerPedidosMaterial3t } from "@/05_ACESSO_A_DADOS/Supabase/pedido-material-3t";

// Marco 3J: reúne em um só lugar tudo o que os funcionários pediram ou avisaram pelo app
// (antes ficava espalhado: troca no fim de EPIs › Solicitações, problemas no fim de Entrega de EPI,
// itens pessoais dentro da ficha de cada funcionário).
export async function lerPedidosFuncionarios() {
  const repo = await getEpiOperations();
  const [exchanges, flow, items, materiais] = await Promise.all([
    repo.exchangeRequests(),
    repo.delivery3d(),
    readAdminPersonalItems3g().catch(() => null),
    lerPedidosMaterial3t().catch(() => null),
  ]);
  const trocas = exchanges.filter(row => ["SOLICITADA", "EM_ANALISE", "APROVADA"].includes(row.request_status));
  const aprovadas = new Map(flow.approved.map(row => [row.request_id, row]));
  const problemas = flow.feedback.filter(row => row.feedback_status === "DIVERGENCIA" || row.feedback_status === "EM_ANALISE");
  const semConfirmar = flow.feedback.filter(row => row.feedback_status === null || row.feedback_status === "RESOLVIDA" || row.feedback_status === "RECUSA");
  const itens = items === null ? null : items.flatMap(item => item.requests.filter(request => !request.decision)
    .map(request => ({ item, request })));
  // Marco 3T: pedidos de material abertos também esperam resposta.
  const materiaisAbertos = materiais?.filter(p => p.status === "aberto").length ?? 0;
  const aguardando = trocas.filter(row => row.request_status !== "APROVADA").length + problemas.length + (itens?.length ?? 0) + materiaisAbertos;
  return { trocas, aprovadas, problemas, semConfirmar, itens, materiais, aguardando };
}
