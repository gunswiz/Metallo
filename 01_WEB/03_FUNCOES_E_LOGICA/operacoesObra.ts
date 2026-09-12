import { z } from "zod";

const option = z.object({ id: z.string(), name: z.string() });
const nullable = z.string().nullable();
export const siteSnapshotSchema = z.object({
  works: z.array(
    option.extend({ stock_team_id: z.string(), active: z.boolean() }),
  ),
  teams: z.array(
    option.extend({ worksite_id: nullable, central: z.boolean() }),
  ),
  materials: z.array(
    option.extend({
      code: z.string(),
      unit: z.string(),
      stock: z.array(z.object({ team_id: z.string(), quantity: z.number() })),
    }),
  ),
  epi_items: z.array(
    option.extend({
      code: z.string(),
      kind: z.string(),
      variants: z.array(z.string()),
    }),
  ),
  batches: z.array(
    z.object({
      id: z.string(),
      item_id: z.string(),
      quantity: z.number(),
      variant: nullable,
      ca_number: nullable,
      worksite_id: nullable,
    }),
  ),
  employees: z.array(
    option.extend({ team_id: z.string(), home_team_id: z.string() }),
  ),
  assignments: z.array(
    z.object({
      id: z.string(),
      employee_id: z.string(),
      team_id: z.string(),
      starts_at: z.string(),
      ends_at: nullable,
      note: nullable,
    }),
  ),
  assets: z.array(
    option.extend({
      code: z.string(),
      number: nullable,
      company: nullable,
      team_id: nullable,
      status: z.string(),
      active: z.boolean(),
      ownership: z.string(),
    }),
  ),
  orders: z.array(
    z.object({
      id: z.string(),
      team_id: z.string(),
      status: z.string(),
      note: nullable,
      occurred_at: z.string(),
      created_at: z.string(),
      lines: z.array(
        z.object({
          id: z.string(),
          kind: z.string(),
          description: z.string(),
          variant: nullable,
          quantity: z.number(),
          received_quantity: z.number(),
        }),
      ),
      events: z.array(
        z.object({
          id: z.string(),
          event: z.string(),
          quantity: z.number().nullable(),
          note: nullable,
          occurred_at: z.string(),
          recorded_at: z.string(),
        }),
      ),
    }),
  ),
  rental_returns: z.array(
    z.object({
      id: z.string(),
      asset_id: z.string(),
      team_id: z.string(),
      note: z.string(),
      status: z.string(),
      occurred_at: z.string(),
    }),
  ),
  rental_details: z.array(
    z.object({
      asset_id: z.string(),
      amount: z.number().nullable(),
      billing_period: nullable,
      expected_return: nullable,
      billing_closed_on: nullable,
      note: nullable,
    }),
  ),
  alerts: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      section: z.string(),
    }),
  ),
});
export type SiteSnapshot = z.infer<typeof siteSnapshotSchema>;
export const orderStatusLabels: Record<string, string> = {
  submitted: "Enviado à ADM",
  awaiting_owner: "Aguardando o patrão",
  approved: "Aprovado",
  ordered: "Compra / locação providenciada",
  partial: "Recebimento parcial",
  received: "Recebido por completo",
  rejected: "Não aprovado",
  cancelled: "Cancelado",
  pending: "Aguardando a ADM",
  arranged: "Devolução combinada",
  returned: "Devolvido à locadora",
};
export const orderTransitions: Record<string, string[]> = {
  submitted: ["awaiting_owner", "rejected", "cancelled"],
  awaiting_owner: ["approved", "rejected", "cancelled"],
  approved: ["ordered", "cancelled"],
  ordered: ["cancelled"],
};
export type PendingOperation = {
  id: string;
  command: string;
  data: Record<string, unknown>;
  occurredAt: string;
  error?: string;
};
export function eventTime(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error("Informe a data e a hora do fato.");
  const date = new Date(`${value}:00-03:00`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.getTime() > Date.now() + 300000 ||
    date.getFullYear() < 2000
  )
    throw new Error("Confira a data e a hora do fato.");
  return date.toISOString();
}
export function localEventTime(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(date)
    .replace(" ", "T");
}
export function operationErrorMessage(message: string) {
  const messages: Record<string, string> = {
    worksite_required:
      "Peça à ADM para vincular esta equipe a uma obra antes de registrar o estoque de EPI.",
    same_worksite_stock: "Origem e destino já usam o mesmo estoque de EPI.",
    rental_already_registered:
      "Esta máquina já está registrada na empresa. Confira a locadora e a numeração.",
    operation_actor_mismatch:
      "Entre novamente na conta que criou o lançamento.",
    forbidden: "Seu acesso não permite essa operação ou equipe.",
    admin_required: "Esta operação pertence à ADM.",
    insufficient:
      "Estoque insuficiente. Confira a quantidade antes de reenviar.",
    invalid_quantity: "A quantidade ultrapassa o saldo ou o que falta receber.",
    invalid_order_transition: "O pedido mudou de etapa. Atualize a lista.",
    order_not_receivable:
      "A ADM ainda não marcou a compra ou locação como providenciada.",
    ca_required: "Informe o C.A. do EPI recebido.",
    wrong_worksite_stock: "O lote selecionado pertence a outra obra.",
    rental_identification_required:
      "Informe a locadora e um número para cada máquina recebida.",
    duplicate: "Já existe um registro com essa identificação.",
    unique: "Já existe um registro com essa identificação.",
    stock_team_cannot_move:
      "A equipe que guarda o estoque principal não pode ser movida para outra obra.",
    assignment_date_conflict:
      "As datas entram em conflito com uma alocação já registrada.",
    invalid_operation_time: "Confira a data e a hora do fato.",
    invalid_variant: "Escolha uma variante válida do item.",
  };
  return (
    Object.entries(messages).find(([key]) => message.includes(key))?.[1] ??
    "Não foi possível confirmar. O lançamento ficou pendente para conferência e reenvio."
  );
}
