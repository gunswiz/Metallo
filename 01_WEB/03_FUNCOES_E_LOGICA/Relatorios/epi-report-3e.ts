import { z } from "zod";
import { consumptionQuantity, consumptionUnit } from "../unidadesConsumo";

// Mensagens públicas uniformes: não expõem o erro SQL nem a existência de outro titular.
export function epiReportFailure(cause: unknown): { status: 404 | 422 | 503; message: string } {
  const message = cause instanceof Error ? cause.message : "";
  if (/epi_report_access_denied|employee_not_found/.test(message))
    return { status: 404, message: "Relatório indisponível." };
  if (message.includes("epi_report_too_large"))
    return { status: 422, message: "O histórico excede o limite de consulta deste laboratório. Solicite conferência à administração. Reduzir o período não reduz a extração atual." };
  if (message.startsWith("Relatório muito extenso.") || message.startsWith("Ficha muito extensa."))
    return { status: 422, message };
  return { status: 503, message: "Não foi possível gerar o relatório agora. Confirme que o laboratório local está disponível." };
}

const dateTime = z.string().refine(value => Number.isFinite(Date.parse(value)));
const optionalText = z.string().nullable();
const delivery = z.object({
  id: z.uuid(), item_id: z.uuid(), group_id: z.uuid().nullable(), item_name: z.string(), legacy_name: z.boolean(),
  ca: optionalText, quantity: z.number().int().positive(), unit: z.string(), legacy_unit: z.boolean(),
  variant: optionalText, lot: optionalText, brand: optionalText, delivered_at: dateTime,
  status: z.enum(["active", "returned", "replaced", "lost", "damaged", "consumed"]),
  closed_at: dateTime.nullable(), reason: z.string(), team: optionalText, work: optionalText,
  exchange_request_id: z.uuid().nullable(), employee_name_snapshot: optionalText,
  profession_snapshot: optionalText, responsible_id: z.uuid().nullable(),
  responsible_name_snapshot: optionalText.optional(),
});
const feedback = z.object({
  id: z.number().int(), group_id: z.uuid(), delivery_id: z.uuid().nullable(),
  type: z.enum(["CONFIRMADO", "DIVERGENCIA", "EM_ANALISE", "RESOLVIDA", "RECUSA"]),
  category: optionalText, at: dateTime,
});
const exchange = z.object({
  id: z.uuid(), source_delivery_id: z.uuid(), item_name: z.string(), ca: optionalText,
  reason: z.string(), created_at: dateTime, new_group_id: z.uuid().nullable(),
  events: z.array(z.object({ id: z.number().int(), status: z.string(), at: dateTime })),
});
export const epiReportPayloadSchema = z.object({
  employee: z.object({ id: z.uuid(), name: z.string().min(1), registration: optionalText,
    profession: z.string(), team: optionalText }),
  generated_at: dateTime, report_id: z.uuid(), deliveries: z.array(delivery).max(3000),
  feedback: z.array(feedback).max(3000), exchanges: z.array(exchange).max(3000),
});
export type EpiReportPayload = z.infer<typeof epiReportPayloadSchema>;
export type EpiReportType = "current" | "history";
export type EpiEventKind = "entrega" | "confirmacao" | "troca" | "devolucao" | "divergencia" | "encerramento";
export type EpiEventFilter = "all" | EpiEventKind;
export type EpiPeriod = { preset: "all" | "today" | "week" | "month" | "30days" | "year" | "custom";
  from: string | null; to: string | null; label: string };
export type EpiReportEvent = { id: string; at: string; kind: EpiEventKind; title: string;
  item: string; details: string[]; originAt?: string };
export type EpiReport = { type: EpiReportType; payload: EpiReportPayload; period: EpiPeriod;
  eventFilter: EpiEventFilter; events: EpiReportEvent[]; current: Array<EpiReportPayload["deliveries"][number] & {
    feedbackLabel: string; reportReference: string; groupReference: string | null }>;
  legacyCount: number };

const localDate = (date: Date) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit",
}).format(date);
const brDate = (value: string) => value.split("-").reverse().join("/");
export const reportDate = (value: string) => new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Fortaleza", dateStyle: "short", timeStyle: "short",
}).format(new Date(value));
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) &&
  new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
const shiftDay = (iso: string, days: number) => {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
export function resolveEpiPeriod(input: { preset?: string; from?: string; to?: string }, now = new Date()): EpiPeriod {
  const today = localDate(now);
  const preset = input.preset ?? "all";
  if (preset === "all") return { preset, from: null, to: null, label: "Todo o histórico" };
  let from: string, to = today;
  if (preset === "custom") {
    from = input.from ?? ""; to = input.to ?? "";
    if (!validDate(from) || !validDate(to) || from > to) throw new Error("Período inválido. Confira as datas inicial e final.");
  } else if (preset === "today") from = today;
  else if (preset === "week") {
    const day = new Date(`${today}T12:00:00Z`).getUTCDay();
    from = shiftDay(today, -(day === 0 ? 6 : day - 1));
  } else if (preset === "month") from = `${today.slice(0, 7)}-01`;
  else if (preset === "30days") from = shiftDay(today, -29);
  else if (preset === "year") from = `${today.slice(0, 4)}-01-01`;
  else throw new Error("Filtro de período inválido.");
  return { preset: preset as EpiPeriod["preset"], from, to, label: `${brDate(from)} a ${brDate(to)}` };
}

const statusLabel: Record<string, string> = {
  returned: "Devolução registrada", replaced: "Encerrado como substituído",
  lost: "Encerrado como perdido", damaged: "Encerrado como danificado",
  consumed: "Encerrado como consumido",
};
const exchangeLabel: Record<string, string> = {
  SOLICITADA: "Solicitação de troca", EM_ANALISE: "Troca em análise", APROVADA: "Troca aprovada",
  RECUSADA: "Troca recusada", CANCELADA: "Solicitação cancelada",
};
const reasonLabel: Record<string, string> = {
  DESGASTE: "Desgaste", DANO: "Dano", PERDA_EXTRAVIO: "Perda ou extravio", OUTRO: "Outro motivo",
};
const categoryLabel: Record<string, string> = {
  ITEM_FALTANDO: "Item faltando", QUANTIDADE: "Quantidade diferente", TAMANHO: "Tamanho diferente",
  VARIANTE: "Variante diferente", NAO_RECEBIDO: "Entrega não recebida", OUTRO: "Outra divergência",
};
export const epiEventFilterLabel: Record<EpiEventFilter, string> = {
  all: "Todos", entrega: "Entregas", confirmacao: "Confirmações", troca: "Trocas",
  devolucao: "Devoluções", divergencia: "Divergências", encerramento: "Outros encerramentos",
};
export function epiReportQuantity(quantity: number, unit: string) {
  if (!unit.trim()) return `${quantity} (unidade não registrada)`;
  const normalized = unit.trim().toLocaleLowerCase("pt-BR").replace(/\.$/, "");
  if (normalized === "par" || normalized === "pares") return `${quantity} ${quantity === 1 ? "par" : "pares"}`;
  return consumptionQuantity(quantity, consumptionUnit(unit));
}
export const epiReportResponsible = (row: EpiReportPayload["deliveries"][number]) =>
  row.responsible_name_snapshot?.trim()
    ? `Responsável pela entrega: ${row.responsible_name_snapshot.trim()}`
    : "Responsável pela entrega: não registrado nominalmente no histórico.";

export type EpiPrintedSupply = { title: "ENTREGA" | "ENTREGA PARA TROCA" | "SUBSTITUIÇÃO"; at: string;
  item: string; ca: string; quantity: string; responsible: string; receipt: string };

// Situação da confirmação do funcionário para cada entrega. Na via impressa, substitui a
// assinatura manuscrita: o registro eletrônico é aceito pela NR-6 (item 6.5.1, alínea "d").
type FeedbackRow = EpiReportPayload["feedback"][number];
function latestFeedbackByGroup(feedback: FeedbackRow[]) {
  const latest = new Map<string, FeedbackRow>();
  for (const row of feedback) {
    const previous = latest.get(row.group_id);
    if (!previous || Date.parse(row.at) > Date.parse(previous.at) ||
      (Date.parse(row.at) === Date.parse(previous.at) && row.id > previous.id)) latest.set(row.group_id, row);
  }
  return latest;
}
export function epiReceiptLabel(groupId: string | null, state: FeedbackRow | null | undefined) {
  if (!groupId) return "Sem confirmação eletrônica registrada";
  if (!state) return "Confirmação do funcionário pendente";
  if (state.type === "CONFIRMADO") return `Recebimento confirmado pelo funcionário no portal em ${reportDate(state.at)}`;
  if (state.type === "RESOLVIDA") return "Divergência resolvida; confirmação pendente";
  if (state.type === "RECUSA") return "Recusa registrada pela Gestão; confirmação do funcionário pendente";
  return "Divergência informada pelo funcionário, em andamento";
}

// Projeção exclusiva da via humana. O payload e os eventos técnicos não são alterados.
// Filtros operacionais da trilha técnica não selecionam fatos no PDF de fornecimento.
export function epiPrintedSupplies(report: EpiReport): EpiPrintedSupply[] {
  const deliveries = report.type === "current" ? report.current : report.payload.deliveries.filter(row =>
    (!report.period.from || localDate(new Date(row.delivered_at)) >= report.period.from) &&
    (!report.period.to || localDate(new Date(row.delivered_at)) <= report.period.to));
  const byId = new Map(report.payload.deliveries.map(row => [row.id, row]));
  const exchanges = new Map(report.payload.exchanges.map(row => [row.id, row]));
  const latest = latestFeedbackByGroup(report.payload.feedback);
  return [...deliveries].sort((a, b) => Date.parse(a.delivered_at) - Date.parse(b.delivered_at) || a.id.localeCompare(b.id))
    .map(row => {
      const request = row.exchange_request_id ? exchanges.get(row.exchange_request_id) : null;
      const source = request ? byId.get(request.source_delivery_id) : null;
      // Motivo/vínculo registram a finalidade da entrega, sem encerrar o item anterior.
      const forReplacement = row.reason === "replacement" && (!row.exchange_request_id ||
        Boolean(source && source.item_id === row.item_id && row.group_id && request?.new_group_id === row.group_id));
      // Só declara substituição se a origem já estava formalmente encerrada como tal
      // no instante dessa entrega. Não infere baixa nem usa encerramento posterior.
      const replacement = forReplacement && source?.status === "replaced" && source.closed_at !== null &&
        Date.parse(source.closed_at) >= Date.parse(source.delivered_at) &&
        Date.parse(source.closed_at) <= Date.parse(row.delivered_at) &&
        Date.parse(row.delivered_at) <= Date.parse(report.payload.generated_at);
      // Evita repetir o rótulo CA sem modificar o snapshot ou descartar valores não numéricos.
      const ca = row.ca?.trim().replace(/^CA\s*[-:]?\s*(\d+)$/i, "$1") || "Não registrado";
      return { title: replacement ? "SUBSTITUIÇÃO" : forReplacement ? "ENTREGA PARA TROCA" : "ENTREGA", at: row.delivered_at,
        item: row.item_name, ca, quantity: epiReportQuantity(row.quantity, row.unit),
        responsible: row.responsible_name_snapshot?.trim() || "Não registrado",
        // Tamanho/variante (M, G, GG, 42…) fica só na trilha técnica: decisão do responsável para não poluir a via impressa.
        receipt: epiReceiptLabel(row.group_id, row.group_id ? latest.get(row.group_id) : null) };
    });
}

export function projectEpiReport(raw: unknown, type: EpiReportType, period: EpiPeriod,
  eventFilter: EpiEventFilter = "all"): EpiReport {
  const payload = epiReportPayloadSchema.parse(raw);
  const byId = new Map(payload.deliveries.map(row => [row.id, row]));
  const exchangeById = new Map(payload.exchanges.map(row => [row.id, row]));
  const groupItems = new Map<string, typeof payload.deliveries>();
  const ordered = [...payload.deliveries].sort((a, b) => Date.parse(a.delivered_at) - Date.parse(b.delivered_at) || a.id.localeCompare(b.id));
  const references = new Map(ordered.map((row, index) => [row.id, `Entrega ${String(index + 1).padStart(3, "0")}`]));
  const groups = new Map<string, string>();
  for (const row of ordered) if (row.group_id && !groups.has(row.group_id))
    groups.set(row.group_id, `Grupo ${String(groups.size + 1).padStart(3, "0")}`);
  for (const row of payload.deliveries) if (row.group_id)
    groupItems.set(row.group_id, [...(groupItems.get(row.group_id) ?? []), row]);
  const events: EpiReportEvent[] = [];
  for (const row of payload.deliveries) {
    const linkedExchange = row.exchange_request_id ? exchangeById.get(row.exchange_request_id) : null;
    const source = linkedExchange ? byId.get(linkedExchange.source_delivery_id) : null;
    const incompatible = source && source.item_id !== row.item_id;
    events.push({ id: `delivery-${row.id}`, at: row.delivered_at, kind: "entrega",
      title: incompatible ? "Entrega com vínculo de troca incompatível" :
        row.exchange_request_id ? "Entrega vinculada a pedido de troca" : "Entrega registrada",
      item: row.item_name, originAt: source?.delivered_at, details: [
        `CA registrado na entrega: ${row.ca ?? "Não registrado"}`,
        `Quantidade: ${epiReportQuantity(row.quantity, row.unit)}`,
        row.variant ? `Tamanho / variante: ${row.variant}` : "",
        row.lot ? `Lote: ${row.lot}` : "", row.brand ? `Marca / modelo: ${row.brand}` : "",
        row.employee_name_snapshot ? `Nome do funcionário na entrega: ${row.employee_name_snapshot}` : "",
        row.profession_snapshot ? `Função na entrega: ${row.profession_snapshot}` : "",
        `Referência neste relatório: ${references.get(row.id)}`,
        row.group_id ? `Agrupamento neste relatório: ${groups.get(row.group_id)}` : "",
        epiReportResponsible(row),
        source ? `Entrega anterior relacionada: ${reportDate(source.delivered_at)} (${references.get(source.id)})` : "",
        incompatible ? "ATENÇÃO: o vínculo contém um EPI diferente e não comprova atendimento à solicitação de troca." : "",
        row.exchange_request_id && !source ? "Vínculo de troca: entrega original não disponível para conferir compatibilidade." : "",
        row.legacy_name || row.legacy_unit ? "Registro legado: nome/unidade consultados no catálogo atual; sem snapshot histórico." : "",
      ].filter(Boolean) });
    if (row.closed_at) events.push({ id: `close-${row.id}`, at: row.closed_at,
      kind: row.status === "returned" ? "devolucao" : row.status === "replaced" ? "troca" : "encerramento",
      title: statusLabel[row.status] ?? "Encerramento registrado",
      item: row.item_name, originAt: row.delivered_at,
      details: [`Entrega original relacionada: ${reportDate(row.delivered_at)}`] });
  }
  for (const row of payload.feedback) {
    const items = groupItems.get(row.group_id) ?? [];
    const selected = row.delivery_id ? byId.get(row.delivery_id) : null;
    events.push({ id: `feedback-${row.id}`, at: row.at,
      kind: row.type === "CONFIRMADO" ? "confirmacao" : "divergencia",
      title: ({ CONFIRMADO: "Recebimento confirmado no portal", DIVERGENCIA: "Divergência informada",
        EM_ANALISE: "Divergência em análise", RESOLVIDA: "Divergência resolvida",
        RECUSA: "Recusa registrada pela Gestão" })[row.type],
      item: selected?.item_name ?? (items.length === 1 ? items[0].item_name : "Grupo de entrega"),
      originAt: items[0]?.delivered_at,
      details: [row.category ? `Categoria: ${categoryLabel[row.category] ?? "Categoria não identificada no formato do relatório"}` : "",
        items[0] ? `Entrega relacionada: ${reportDate(items[0].delivered_at)}` : ""].filter(Boolean),
    });
  }
  for (const row of payload.exchanges) {
    const source = byId.get(row.source_delivery_id);
    const relation = source ? `Entrega original relacionada: ${reportDate(source.delivered_at)} (${references.get(source.id)})` : "Entrega original: data não registrada";
    const incompatible = source && row.new_group_id &&
      (groupItems.get(row.new_group_id) ?? []).some(item => item.item_id !== source.item_id);
    events.push({ id: `exchange-${row.id}`, at: row.created_at, kind: "troca", title: "Solicitação de troca",
      item: row.item_name, originAt: source?.delivered_at,
      details: [`Motivo: ${reasonLabel[row.reason] ?? "Motivo não identificado no formato do relatório"}`, relation] });
    for (const step of row.events) {
      if (step.status === "SOLICITADA") continue; // mesmo fato do pedido, sem duplicar
      events.push({ id: `exchange-step-${step.id}`, at: step.at, kind: "troca",
        title: exchangeLabel[step.status] ?? "Atualização do pedido de troca", item: row.item_name,
        originAt: source?.delivered_at, details: [relation,
          row.new_group_id && step.status === "APROVADA" ? incompatible
            ? "ATENÇÃO: nova entrega vinculada contém EPI diferente; não comprova atendimento desta troca."
            : "Há nova entrega vinculada; aprovação não equivale à entrega ou à confirmação." : ""].filter(Boolean) });
    }
  }
  const filtered = events.filter(event =>
    (!period.from || localDate(new Date(event.at)) >= period.from) &&
    (!period.to || localDate(new Date(event.at)) <= period.to) &&
    (eventFilter === "all" || event.kind === eventFilter));
  filtered.sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id));
  const latest = latestFeedbackByGroup(payload.feedback);
  const current = payload.deliveries.filter(row => row.status === "active").map(row => {
    const state = row.group_id ? latest.get(row.group_id) : null;
    const feedbackLabel = !row.group_id ? "Sem confirmação eletrônica registrada" :
      !state ? "Confirmação pendente" : state.type === "CONFIRMADO" ?
      `Recebimento confirmado no portal em ${reportDate(state.at)}` :
      state.type === "RESOLVIDA" ? "Divergência resolvida; confirmação pendente" :
      state.type === "RECUSA" ? "Recusa registrada pela Gestão; confirmação pendente" : "Divergência em andamento";
    return { ...row, feedbackLabel, reportReference: references.get(row.id)!,
      groupReference: row.group_id ? groups.get(row.group_id)! : null };
  });
  return { type, payload, period, eventFilter, events: filtered, current,
    legacyCount: payload.deliveries.filter(row => row.legacy_name || row.legacy_unit).length };
}
