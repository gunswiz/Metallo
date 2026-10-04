import { z } from "zod";

// Marco 5A — Treinamentos (NR) e ASO com vencimento. Contrato das funções do banco (somente leitura de dados pessoais
// do próprio funcionário no app; Gestão vê só o seu escopo de EPI).
const dia = z.iso.date();
export const situacao5a = z.enum(["EM_DIA", "VENCE_EM_BREVE", "VENCIDO", "SEM_VENCIMENTO"]);
export const situacaoFicha5a = z.enum(["EM_DIA", "VENCE_EM_BREVE", "VENCIDO", "FALTANDO"]);
export const treinamento5a = z.object({
  id: z.uuid(), type_code: z.string(), name: z.string(), nr: z.string().nullable(),
  completed_on: dia, expires_on: dia.nullable(), provider: z.string().nullable(), workload_hours: z.number().nullable(),
  situacao: situacao5a, required: z.boolean(),
}).strict();
export const ficha5a = z.object({
  name: z.string(), profession: z.string(),
  aso: z.object({ aso_exam_date: dia.nullable(), aso_expiry_date: dia.nullable(),
    situacao: z.enum(["EM_DIA", "VENCE_EM_BREVE", "VENCIDO", "NAO_INFORMADO"]) }).strict(),
  trainings: z.array(treinamento5a),
  missing: z.array(z.object({ type_code: z.string(), name: z.string(), nr: z.string().nullable() }).strict()),
  situacao: situacaoFicha5a,
}).strict();
export type Ficha5a = z.infer<typeof ficha5a>;
export const fichaGestao5a = ficha5a.extend({ employee_id: z.uuid(), team_id: z.uuid().nullable(), team_name: z.string().nullable() }).strict();
export type FichaGestao5a = z.infer<typeof fichaGestao5a>;
export const catalogo5a = z.object({
  types: z.array(z.object({ code: z.string(), name: z.string(), nr: z.string().nullable(), validity_months: z.number().int().nullable(),
    active: z.boolean(), updated_at: z.string() }).strict()),
  requirements: z.array(z.object({ profession: z.string(), type_code: z.string() }).strict()),
}).strict();
export type Catalogo5a = z.infer<typeof catalogo5a>;

export const rotuloSituacao5a: Record<string, string> = {
  EM_DIA: "Em dia", VENCE_EM_BREVE: "Vence em breve", VENCIDO: "Vencido", SEM_VENCIMENTO: "Em dia (sem vencimento)",
  FALTANDO: "Falta treinamento ou ASO", NAO_INFORMADO: "ASO não informado",
};
export const dataBr5a = (value: string | null) => value ? value.split("-").reverse().join("/") : "—";
// Dias até vencer (negativo = vencido), contando no calendário de Fortaleza.
export function diasPara5a(value: string | null, hoje = new Date()) {
  if (!value) return null;
  const hojeLocal = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(hoje);
  return Math.round((Date.parse(`${value}T00:00:00Z`) - Date.parse(`${hojeLocal}T00:00:00Z`)) / 86_400_000);
}
export function prazo5a(value: string | null, hoje = new Date()) {
  const dias = diasPara5a(value, hoje);
  if (dias === null) return "sem vencimento";
  if (dias < 0) return `venceu há ${-dias} ${dias === -1 ? "dia" : "dias"}`;
  if (dias === 0) return "vence hoje";
  return `vence em ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

export const registroTreinamento5a = z.object({
  employeeId: z.uuid(), typeCode: z.string().regex(/^[A-Z0-9_-]{2,20}$/), completedOn: dia,
  expiresOn: z.union([dia, z.literal("")]).default(""), provider: z.string().trim().max(120).default(""),
  workloadHours: z.union([z.coerce.number().min(0.5).max(400), z.literal("")]).default(""),
  note: z.string().trim().max(240).default(""), idempotencyKey: z.uuid(), voltar: z.enum(["funcionario"]).optional(),
}).refine(value => !value.expiresOn || value.expiresOn > value.completedOn, { message: "A validade deve ser depois da data do treinamento." });
export const cancelamentoTreinamento5a = z.object({ trainingId: z.uuid(), reason: z.string().trim().min(3).max(240) });
export const tipoTreinamento5a = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{2,20}$/), name: z.string().trim().min(2).max(80),
  nr: z.union([z.string().trim().regex(/^NR-\d{2}$/), z.literal("")]).default(""),
  validityMonths: z.union([z.coerce.number().int().min(1).max(120), z.literal("")]).default(""),
  active: z.enum(["on", ""]).default(""),
});
export const exigenciasFuncao5a = z.object({ profession: z.string().trim().min(1).max(60), types: z.array(z.string().regex(/^[A-Z0-9_-]{2,20}$/)).max(30) });
