// @vitest-environment-options {"url":"http://127.0.0.1:3101"}
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MeusTreinamentos } from "@/app/colaborador/[[...screen]]/meus-treinamentos";
import { cancelamentoTreinamento5a, diasPara5a, ficha5a, prazo5a, registroTreinamento5a, type Ficha5a } from "@/03_FUNCOES_E_LOGICA/Treinamentos/contrato-5a";
import { portalFetch } from "@/05_ACESSO_A_DADOS/Supabase/colaborador-local";

// Marco 5A — Treinamentos e ASO com vencimento.
const base: Ficha5a = { name: "João Sintético", profession: "welder", situacao: "VENCIDO",
  aso: { aso_exam_date: "2025-01-10", aso_expiry_date: "2026-01-10", situacao: "VENCIDO" },
  trainings: [{ id: "33333333-3333-4333-8333-333333333333", type_code: "NR35", name: "Trabalho em altura", nr: "NR-35",
    completed_on: "2024-10-20", expires_on: "2026-10-20", provider: null, workload_hours: 8, situacao: "VENCE_EM_BREVE", required: true }],
  missing: [{ type_code: "NR06", name: "Uso, guarda e conservação de EPI", nr: "NR-06" }] };
afterEach(cleanup);

it("contrato pessoal aceita a ficha e recusa campos internos (equipe, id do funcionário)", () => {
  expect(ficha5a.parse(base).trainings).toHaveLength(1);
  expect(() => ficha5a.parse({ ...base, team_id: "x" })).toThrow();
  expect(() => ficha5a.parse({ ...base, employee_id: "x" })).toThrow();
  expect(() => ficha5a.parse({ ...base, trainings: [{ ...base.trainings[0], created_by: "gestor" }] })).toThrow();
});

it("prazo em linguagem simples, no calendário de Fortaleza", () => {
  const agora = new Date("2026-10-04T15:00:00Z");
  expect(diasPara5a("2026-10-04", agora)).toBe(0);
  expect(prazo5a("2026-10-04", agora)).toBe("vence hoje");
  expect(prazo5a("2026-10-05", agora)).toBe("vence em 1 dia");
  expect(prazo5a("2026-10-01", agora)).toBe("venceu há 3 dias");
  expect(prazo5a(null, agora)).toBe("sem vencimento");
  // 02h em Fortaleza ainda é o mesmo dia, mesmo já sendo o dia seguinte em UTC.
  expect(diasPara5a("2026-10-04", new Date("2026-10-05T02:00:00Z"))).toBe(0);
});

it("app mostra aviso forte quando algo venceu, o que falta e o que vence em breve", async () => {
  render(<MeusTreinamentos read={async () => base}/>);
  expect(await screen.findByText("Vencido", { selector: "strong" })).toBeInTheDocument();
  expect(screen.getByText(/Não faça essa atividade até regularizar/)).toBeInTheDocument();
  expect(screen.getByText("NR-06 · Uso, guarda e conservação de EPI")).toBeInTheDocument();
  expect(screen.getByText("Falta")).toBeInTheDocument();
  expect(screen.getByText("Vence em breve")).toBeInTheDocument();
});

it("app em dia mostra mensagem tranquila", async () => {
  render(<MeusTreinamentos read={async () => ({ ...base, situacao: "EM_DIA", missing: [], aso: { ...base.aso, situacao: "EM_DIA", aso_expiry_date: "2099-01-01" },
    trainings: [{ ...base.trainings[0], situacao: "EM_DIA" }] })}/>);
  expect(await screen.findByText("Tudo em dia")).toBeInTheDocument();
});

it("falha de conexão não mostra dados antigos e oferece tentar de novo", async () => {
  const read = vi.fn(async () => { throw new Error("Failed to fetch"); });
  render(<MeusTreinamentos read={read}/>);
  expect(await screen.findByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
});

it("formulários da Gestão validam datas, motivo e chave de repetição", () => {
  const ok = { employeeId: "33333333-3333-4333-8333-333333333333", typeCode: "NR35", completedOn: "2026-09-01", idempotencyKey: "44444444-4444-4444-8444-444444444444" };
  expect(registroTreinamento5a.safeParse(ok).success).toBe(true);
  expect(registroTreinamento5a.safeParse({ ...ok, expiresOn: "2026-08-01" }).success).toBe(false);
  expect(registroTreinamento5a.safeParse({ ...ok, typeCode: "nr35;drop" }).success).toBe(false);
  expect(registroTreinamento5a.safeParse({ ...ok, idempotencyKey: "" }).success).toBe(false);
  expect(cancelamentoTreinamento5a.safeParse({ trainingId: ok.employeeId, reason: "x" }).success).toBe(false);
});

it("app só chama a função pessoal de treinamentos (sem tabela direta)", async () => {
  const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
  try {
    await portalFetch("http://127.0.0.1:54321/rest/v1/rpc/my_trainings_5a", { method: "POST", body: "{}" });
    for (const url of ["http://127.0.0.1:54321/rest/v1/rpc/admin_trainings_overview_5a", "http://127.0.0.1:54321/rest/v1/employee_trainings_5a"])
      await expect(portalFetch(url)).rejects.toThrow("Destino local não autorizado.");
    expect(fetcher).toHaveBeenCalledTimes(1);
  } finally { fetcher.mockRestore(); }
});
