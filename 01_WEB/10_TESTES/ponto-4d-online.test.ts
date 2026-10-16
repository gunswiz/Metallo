import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as pointGet, POST as pointPost } from "@/app/api/ponto-online/[...path]/route";
import * as transport from "@/05_ACESSO_A_DADOS/Ponto/transporte-laboratorio";
import { destinoPonto } from "@/05_ACESSO_A_DADOS/Ponto/destino-ponto";
import { pointReceipt } from "@/05_ACESSO_A_DADOS/Ponto/ponto-online";
import { PDFDocument } from "pdf-lib";
import { onlineRecord4d, personalRecord } from "@/05_ACESSO_A_DADOS/Ponto/registros";
import { anyReceiptFilename, buildAnyReceipt } from "@/03_FUNCOES_E_LOGICA/Relatorios/ponto-comprovante-4d";
import { TESTE_ONLINE_PONTO_4D } from "@/09_CONFIGURACOES/ambiente-teste-online";
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it("prévia local do ponto exige desenvolvimento explícito e mantém o destino de teste", async () => {
  const config = { NODE_ENV: "development", NEXT_PUBLIC_METALLO_TESTE_PREVIEW: "1", METALLO_COLABORADOR_TESTE_ONLINE: "1", METALLO_LOCAL_PREVIEW: "0", METALLO_COLABORADOR_PREVIEW: "0" };
  for (const [key, value] of Object.entries(config)) vi.stubEnv(key, value);
  expect(destinoPonto()).toMatchObject({ host: "127.0.0.1:3101", requestOrigin: "http://127.0.0.1:3101", online: true });
  const fetcher = vi.spyOn(transport, "pointLaboratoryFetch").mockResolvedValue(Response.json({ server_at: "2026-10-15T12:00:00Z" }));
  const request = new NextRequest("http://127.0.0.1:3101/api/ponto-online/clock", { headers: { host: "127.0.0.1:3101", authorization: "Bearer synthetic.test.token-value" } });
  expect((await pointGet(request, { params: Promise.resolve({ path: ["clock"] }) })).status).toBe(200);
  expect(fetcher).toHaveBeenCalledWith(`${TESTE_ONLINE_PONTO_4D}/v4a/clock`, expect.objectContaining({ headers: expect.objectContaining({ Origin: "https://metallo-teste-colaborador.metallo-gunswiz.workers.dev" }) }));
  fetcher.mockClear();
  const post = new NextRequest("http://127.0.0.1:3101/api/ponto-online/begin", { method: "POST", headers: { host: "127.0.0.1:3101", origin: "http://exemplo.invalid", authorization: "Bearer synthetic.test.token-value", "content-type": "application/json" }, body: "{}" });
  expect((await pointPost(post, { params: Promise.resolve({ path: ["begin"] }) })).status).toBe(400);
  for (const host of ["localhost:3101", "127.0.0.1:3102", "192.168.0.3:3101"]) {
    request.headers.set("host", host);
    expect((await pointGet(request, { params: Promise.resolve({ path: ["clock"] }) })).status).toBe(400);
  }
  request.headers.set("host", "127.0.0.1:3101");
  vi.stubEnv("NODE_ENV", "production");
  expect((await pointGet(request, { params: Promise.resolve({ path: ["clock"] }) })).status).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
});

it("rotas do ponto: laboratório só no PC, teste online só na Edge Function do projeto de teste", () => {
  expect(destinoPonto({})).toBeNull();
  const lab = destinoPonto({ METALLO_LOCAL_PREVIEW: "1", METALLO_COLABORADOR_PREVIEW: "1" });
  expect(lab !== "INDISPONIVEL" && lab?.base("v4a")).toBe("http://127.0.0.1:3106/lab-point/v4a/");
  expect(lab !== "INDISPONIVEL" && lab?.host).toBe("127.0.0.1:3101");
  const online = destinoPonto({ METALLO_COLABORADOR_TESTE_ONLINE: "1" });
  expect(online !== "INDISPONIVEL" && online?.base("v4b")).toBe(`${TESTE_ONLINE_PONTO_4D}/v4b/`);
  expect(online !== "INDISPONIVEL" && online?.origin).toBe("https://metallo-teste-colaborador.metallo-gunswiz.workers.dev");
  expect(TESTE_ONLINE_PONTO_4D).toBe("https://cvimwiqokkujfhwynhmt.supabase.co/functions/v1/ponto-4d");
  expect(destinoPonto({ METALLO_COLABORADOR_TESTE_ONLINE: "1", METALLO_COLABORADOR_PREVIEW: "1" })).toBeNull();
  expect(destinoPonto({ METALLO_LOCAL_PREVIEW: "1", METALLO_COLABORADOR_PREVIEW: "1", METALLO_LOAD_TEST_CORE_PORT: "5432" })).toBe("INDISPONIVEL");
});

const base = { event_id: "6b1e5a4e-2f7a-4d3c-9a77-0c2b8f3e1d10", marking_at: "2026-10-04T10:00:00.123Z", recorded_at: "2026-10-04T10:00:00.456Z",
  timezone: "America/Fortaleza", historical_data: "LIMITED" } as const;
it("recibo online aceita só a referência TESTE-4D", () => {
  const receipt = { event_id: base.event_id, synthetic_reference: "TESTE-4D-12", marking_at: base.marking_at, recorded_at: base.recorded_at,
    timezone: base.timezone, collector: "BROWSER", online: true, location_status: "AVAILABLE", accuracy_meters: 12 };
  expect(pointReceipt.parse(receipt).synthetic_reference).toBe("TESTE-4D-12");
  expect(() => pointReceipt.parse({ ...receipt, synthetic_reference: "PROD-12" })).toThrow();
});
it("comprovante 4D traz NSR, nome e hash; incompleto é recusado", async () => {
  const record = onlineRecord4d.parse({ ...base, reference: "TESTE-4D-7", source: "4D", nsr: 7, payload_hash: "a".repeat(64), employee_name: "João Teste da Silva", employee_code: "TESTE-001" });
  expect(anyReceiptFilename(record)).toBe("comprovante-teste-nsr-7.pdf");
  const pdf = await PDFDocument.load(await buildAnyReceipt(record));
  expect(pdf.getPageCount()).toBe(1); expect(pdf.getCreator()).toBe("4D-TESTE-v1");
  expect(() => onlineRecord4d.parse({ ...record, nsr: 8 })).toThrow();
  expect(() => onlineRecord4d.parse({ ...record, payload_hash: "xyz" })).toThrow();
  // Registro de laboratório continua sem nome retroativo e não vira 4D.
  expect(personalRecord.safeParse({ ...record }).success).toBe(false);
});

it("profissão aparece pelo nome, não pelo código do cadastro", async () => {
  const { nomeProfissao } = await import("@/03_FUNCOES_E_LOGICA/Cadastros/profissao");
  expect(nomeProfissao("welder")).toBe("Soldador");
  expect(nomeProfissao("munck_operator")).toBe("Operador de Munck");
  expect(nomeProfissao("Caldeireiro")).toBe("Caldeireiro");
  expect(nomeProfissao(null)).toBe("");
});
