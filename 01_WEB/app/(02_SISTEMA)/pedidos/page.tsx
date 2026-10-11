import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { formatDateTime } from "@metallo/core";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { OperationForm } from "@/02_COMPONENTES_VISUAIS/formulario-operacao";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { getSupabaseEnv } from "@/09_CONFIGURACOES/ambienteSupabase";
import { recursosNovosLiberados } from "@/09_CONFIGURACOES/ambiente-teste-online";
import { lerPedidosFuncionarios } from "@/05_ACESSO_A_DADOS/Repositorios/pedidos-funcionarios";
import { manageEpiFeedback3d, manageExchangeRequest } from "@/app/actions/epi-completo";
import { decidePersonalItem3g } from "@/app/actions/itens-pessoais-3g";
import { decidirPedidoMaterial3t } from "@/app/actions/pedido-material";

// Marco 3J: caixa de entrada da Gestão para o app do Funcionário.
const motivoTroca: Record<string, string> = { DESGASTE: "Desgaste", DANO: "Danificado", PERDA_EXTRAVIO: "Perda ou extravio", OUTRO: "Outro motivo" };
const estadoTroca: Record<string, string> = { SOLICITADA: "Novo pedido", EM_ANALISE: "Em análise", APROVADA: "Aprovado · falta entregar" };
const problemaEntrega: Record<string, string> = { NAO_RECEBIDO: "Não recebeu", ITEM_FALTANDO: "Item faltando", TAMANHO: "Tamanho errado",
  QUANTIDADE: "Quantidade errada", VARIANTE: "Variante diferente", OUTRO: "Outro problema" };
const motivoItem: Record<string, string> = { WEAR: "Desgaste", DAMAGED: "Danificado", LOST: "Perda ou extravio", OTHER: "Outro" };

export default async function PedidosPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requireCapability("epi:write");
  if (!recursosNovosLiberados(getSupabaseEnv().url)) notFound();
  const query = await searchParams;
  const data = await lerPedidosFuncionarios();
  return <>
    <PageHeader eyebrow="APP DO FUNCIONÁRIO" title="Pedidos dos funcionários"
      description="Tudo o que os funcionários pediram ou avisaram pelo app, em um só lugar. O mais antigo aparece primeiro." />
    {query.ok && <div className="alert success" role="status">{query.ok === "baixa" ? "Atendido e baixado do estoque da obra (lançado como consumo da equipe). O funcionário já vê a resposta no app." : "Registrado. O funcionário já vê a resposta no app."}</div>}
    {data.aguardando === 0 && <div className="alert success" role="status">Nenhum pedido esperando resposta.</div>}
    {query.erro?.startsWith("material") && <div className="alert error" role="alert">{({
      "material-sem-saldo": "Não há saldo suficiente desse material no estoque da obra. O pedido continua aberto: dê entrada no material ou atenda sem dar baixa.",
      "material-sem-equipe": "O funcionário não está em nenhuma equipe, então não dá para saber de qual estoque baixar. Atenda sem dar baixa ou coloque-o numa equipe.",
      "material-sem-permissao": "Seu acesso não permite lançar consumo para a equipe desse funcionário. Atenda sem dar baixa ou peça a quem tem acesso.",
      "material-fracao": "Quantidade com vírgula não pode ser baixada do estoque (o estoque conta em unidades inteiras). Atenda sem dar baixa.",
    } as Record<string, string>)[query.erro] ?? "Não foi possível responder o pedido de material. Para recusar, escreva o motivo."}</div>}

    {data.materiais && <section className="panel" id="pedidos-material" aria-labelledby="pedidos-material-titulo"><header className="panel-header"><div>
      <h2 id="pedidos-material-titulo">Pedidos de material ({data.materiais.filter(p => p.status === "aberto").length})</h2>
      <p>O funcionário pediu pelo app. Ao marcar &ldquo;Atendido&rdquo;, o material já sai do estoque da obra como consumo da equipe dele (pode desmarcar se a saída já foi lançada).</p></div></header>
      {data.materiais.length === 0 ? <div className="panel-body"><p>Nenhum pedido de material.</p></div> :
        <div className="panel-body list">{data.materiais.map(p => <article className="list-row" key={p.id}>
          <div className="list-row-main"><strong>{p.funcionario} · {p.quantidade.toLocaleString("pt-BR")} {p.unidade} de {p.material}</strong>
            <span>{{ aberto: "Esperando resposta", atendido: "Atendido", recusado: "Recusado", cancelado: "Cancelado pelo funcionário" }[p.status]} · pedido em {formatDateTime(p.created_at)}{p.matricula ? ` · ${p.matricula}` : ""}</span>
            {p.observacao && <span>O funcionário escreveu: {p.observacao}</span>}
            {p.resposta && <span>Resposta: {p.resposta}</span>}
            {p.status === "aberto" && p.equipe !== undefined && <span>Equipe: {p.equipe ?? "sem equipe"} · Saldo na obra: {p.saldo_obra === null || p.saldo_obra === undefined ? "0" : p.saldo_obra.toLocaleString("pt-BR")} {p.unidade}
              {(p.saldo_obra ?? 0) < p.quantidade && <strong className="texto-alerta"> · saldo não dá para atender tudo</strong>}</span>}
            {p.status === "atendido" && p.baixa_feita && <span>Baixado do estoque da obra.</span>}</div>
          {p.status === "aberto" && <form action={decidirPedidoMaterial3t} className="inline-action pedido-material-acao">
            <input type="hidden" name="pedidoId" value={p.id} />
            <label className="check-inline"><input type="checkbox" name="baixar" value="1" defaultChecked={(p.saldo_obra ?? 0) >= p.quantidade && Number.isInteger(p.quantidade) && Boolean(p.equipe)} /> Dar baixa no estoque</label>
            <input name="resposta" maxLength={200} placeholder="Resposta ao funcionário (obrigatória se recusar)" aria-label={`Resposta ao pedido de ${p.funcionario}`} />
            <button className="button primary" type="submit" name="status" value="atendido">Atendido</button>
            <button className="button ghost" type="submit" name="status" value="recusado">Recusar</button>
          </form>}
        </article>)}</div>}
    </section>}

    <section className="panel" aria-labelledby="trocas-epi"><header className="panel-header"><div><h2 id="trocas-epi">Trocas de EPI ({data.trocas.length})</h2>
      <p>Aprovar não entrega nem mexe no estoque: depois de aprovar, registre a entrega da troca.</p></div></header>
      {data.trocas.length === 0 ? <div className="panel-body"><p>Nenhum pedido de troca em aberto.</p></div> :
        <div className="panel-body list">{[...data.trocas].reverse().map(row => {
          const aprovada = data.aprovadas.get(row.request_id);
          return <article className="list-row" key={row.request_id}>
            <div className="list-row-main"><strong>{row.employee_name} · {row.item_name}</strong>
              <span>{estadoTroca[row.request_status] ?? row.request_status} · Motivo: {motivoTroca[row.reason] ?? row.reason} · pedido em {formatDateTime(row.requested_at)}</span>
              {row.note && <span>O funcionário escreveu: {row.note}</span>}
              {row.public_decision && <span>Resposta ao funcionário: {row.public_decision}</span>}</div>
            {row.request_status === "APROVADA" ? (aprovada ?
              <Link className="button primary" href={`/epis/entrega-em-lote?employee=${aprovada.employee_id}`}>Entregar a troca</Link> :
              <span className="muted">Aguardando entrega</span>) :
              <OperationForm action={manageExchangeRequest} label={row.request_status === "SOLICITADA" ? "Colocar em análise" : "Responder"}>
                <input type="hidden" name="requestId" value={row.request_id}/><input type="hidden" name="voltar" value="pedidos"/>
                {row.request_status === "SOLICITADA" ? <input type="hidden" name="action" value="EM_ANALISE"/> :
                  <label>Decisão<select name="action" required defaultValue=""><option value="" disabled>Selecione</option>
                    <option value="APROVADA">Aprovar a troca</option><option value="RECUSADA">Recusar</option></select></label>}
                {row.request_status === "EM_ANALISE" && <label>Explique ao funcionário (obrigatório se recusar)<textarea name="publicMessage" maxLength={240} rows={2}/></label>}
                <label>Nota interna (o funcionário não vê)<textarea name="internalNote" maxLength={240} rows={2}/></label>
              </OperationForm>}
          </article>;
        })}</div>}
    </section>

    <section className="panel" aria-labelledby="problemas-entrega"><header className="panel-header"><div><h2 id="problemas-entrega">Problemas avisados na entrega de EPI ({data.problemas.length})</h2>
      <p>O funcionário tocou em “Falta algo ou veio errado”. A entrega original fica guardada.</p></div></header>
      {data.problemas.length === 0 ? <div className="panel-body"><p>Nenhum problema em aberto.</p></div> :
        <div className="panel-body list">{data.problemas.map(row => <article className="list-row" key={row.group_id}>
          <div className="list-row-main"><strong>{row.employee_name}{row.item_name ? ` · ${row.item_name}` : ""}</strong>
            <span>{row.feedback_status === "EM_ANALISE" ? "Em análise" : "Novo aviso"} · {row.category ? problemaEntrega[row.category] ?? row.category : "Problema"} · entrega de {formatDateTime(row.delivered_at)}</span>
            {row.details && <span>O funcionário escreveu: {row.details}</span>}
            {row.public_message && <span>Resposta ao funcionário: {row.public_message}</span>}</div>
          <OperationForm action={manageEpiFeedback3d} label="Registrar">
            <input type="hidden" name="groupId" value={row.group_id}/><input type="hidden" name="idempotencyKey" value={randomUUID()}/><input type="hidden" name="voltar" value="pedidos"/>
            <label>O que fazer<select name="action" defaultValue={row.feedback_status === "DIVERGENCIA" ? "EM_ANALISE" : "RESOLVIDA"}>
              <option value="EM_ANALISE">Colocar em análise</option><option value="RESOLVIDA">Resolvido (o funcionário confirma depois)</option></select></label>
            <label>Mensagem ao funcionário (obrigatória ao resolver)<textarea name="publicMessage" maxLength={240} rows={2}/></label>
            <label>Nota interna (o funcionário não vê)<textarea name="internalNote" maxLength={240} rows={2}/></label>
          </OperationForm>
        </article>)}</div>}
    </section>

    <section className="panel" aria-labelledby="itens-pessoais"><header className="panel-header"><div><h2 id="itens-pessoais">Itens pessoais: trocas e problemas ({data.itens?.length ?? 0})</h2>
      <p>Ferramentas e itens de uso pessoal. Problemas são resolvidos na ficha do funcionário (devolução ou substituição).</p></div></header>
      {data.itens === null ? <div className="panel-body"><p>Consulta de itens pessoais indisponível agora.</p></div> :
        data.itens.length === 0 ? <div className="panel-body"><p>Nenhum pedido de item pessoal em aberto.</p></div> :
        <div className="panel-body list">{data.itens.map(({ item, request }) => <article className="list-row" key={request.request_id}>
          <div className="list-row-main"><strong>{item.employee_name} · {item.item_name}</strong>
            <span>{request.action === "PROBLEM" ? "Problema avisado" : "Pedido de troca"} · {motivoItem[request.reason] ?? request.reason} · {formatDateTime(request.requested_at)}</span>
            {request.note && <span>O funcionário escreveu: {request.note}</span>}</div>
          {request.action === "EXCHANGE_REQUESTED" ? <OperationForm action={decidePersonalItem3g} label="Responder">
            <input type="hidden" name="employeeId" value={item.employee_id}/><input type="hidden" name="requestId" value={request.request_id}/>
            <input type="hidden" name="idempotencyKey" value={randomUUID()}/><input type="hidden" name="voltar" value="pedidos"/>
            <label>Decisão<select name="action" required defaultValue=""><option value="" disabled>Selecione</option>
              <option value="EXCHANGE_APPROVED">Aprovar (a entrega é registrada à parte)</option><option value="EXCHANGE_REFUSED">Recusar</option></select></label>
            <label>Nota opcional<input name="note" maxLength={240}/></label>
          </OperationForm> : <Link className="button secondary" href={`/funcionarios/${item.employee_id}/itens`}>Abrir ficha do funcionário</Link>}
        </article>)}</div>}
    </section>

    <section className="panel" aria-labelledby="sem-confirmar"><header className="panel-header"><div><h2 id="sem-confirmar">Entregas de EPI ainda não confirmadas pelo funcionário ({data.semConfirmar.length})</h2>
      <p>Só para acompanhar. Se a pessoa recusar receber, registre a recusa em Entrega de EPI.</p></div></header>
      {data.semConfirmar.length > 0 && <div className="panel-body list">{data.semConfirmar.map(row => <article className="list-row" key={row.group_id}>
        <div className="list-row-main"><strong>{row.employee_name}</strong><span>Entrega de {formatDateTime(row.delivered_at)}{row.feedback_status === "RECUSA" ? " · recusa registrada" : ""}</span></div>
      </article>)}</div>}
    </section>
  </>;
}
