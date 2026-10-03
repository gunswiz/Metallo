import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, PDFPage } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";
import { buildEpiReport3ePdf, epiReportFilename } from "@/03_FUNCOES_E_LOGICA/Relatorios/epi-report-3e-pdf";
import { epiPrintedSupplies, epiReceiptLabel, reportDate, epiReportFailure, epiReportQuantity, epiReportResponsible, projectEpiReport, resolveEpiPeriod, type EpiReportPayload } from "@/03_FUNCOES_E_LOGICA/Relatorios/epi-report-3e";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const payload: EpiReportPayload = {
  employee: { id: id(1), name: "João Sintético", registration: "LAB-01", profession: "Montador", team: "Equipe Sintética" },
  generated_at: "2026-09-29T15:00:00Z", report_id: id(99),
  deliveries: [
    { id: id(2), item_id: id(20), group_id: id(3), item_name: "Capacete sintético", legacy_name: false,
      ca: "CA-12345", quantity: 1, unit: "un", legacy_unit: false, variant: "M", lot: "L-9", brand: "Marca de teste",
      delivered_at: "2026-01-10T12:00:00Z", status: "active", closed_at: null, reason: "initial",
      team: "Equipe Antiga", work: "Obra Sintética", exchange_request_id: null,
      employee_name_snapshot: "João Sintético", profession_snapshot: "Montador", responsible_id: id(7) },
    { id: id(4), item_id: id(20), group_id: id(5), item_name: "Capacete sintético", legacy_name: false,
      ca: "CA-67890", quantity: 2, unit: "un", legacy_unit: false, variant: "58", lot: null, brand: null,
      delivered_at: "2026-09-15T12:00:00Z", status: "active", closed_at: null, reason: "replacement",
      team: null, work: null, exchange_request_id: id(6),
      employee_name_snapshot: "João Sintético", profession_snapshot: "Montador", responsible_id: id(7) },
  ],
  feedback: [
    { id: 1, group_id: id(3), delivery_id: null, type: "CONFIRMADO", category: null,
      at: "2026-01-10T13:00:00Z" },
    { id: 2, group_id: id(5), delivery_id: id(4), type: "DIVERGENCIA", category: "TAMANHO",
      at: "2026-09-16T12:00:00Z" },
    { id: 3, group_id: id(5), delivery_id: null, type: "RESOLVIDA", category: null,
      at: "2026-09-17T12:00:00Z" },
  ],
  exchanges: [{ id: id(6), source_delivery_id: id(2), item_name: "Capacete sintético", ca: "CA-12345",
    reason: "DESGASTE", created_at: "2026-09-12T12:00:00Z", new_group_id: id(5),
    events: [{ id: 4, status: "SOLICITADA", at: "2026-09-12T12:00:00Z" },
      { id: 5, status: "APROVADA", at: "2026-09-13T12:00:00Z" }] }],
};
const now = new Date("2026-09-29T15:00:00Z");
const all = resolveEpiPeriod({ preset: "all" }, now);

describe("Marco 3E - ficha e histórico", () => {
  it("negação e titular ausente têm a mesma resposta sem sugerir queda do laboratório", () => {
    const denied = epiReportFailure(new Error("epi_report_access_denied"));
    expect(denied.status).toBe(404);
    expect(epiReportFailure(new Error("employee_not_found"))).toEqual(denied);
    expect(denied.message).not.toContain("laboratório");
    expect(epiReportFailure(new Error("offline")).status).toBe(503);
  });
  it("limite de extração não promete resolução pela redução de período", () => {
    const failure = epiReportFailure(new Error("epi_report_too_large"));
    expect(failure.status).toBe(422);
    expect(failure.message).toContain("Reduzir o período não reduz a extração");
    expect(failure.message).not.toContain("epi_report_too_large");
  });
  it("limite do PDF falha de forma controlada sem truncar eventos", async () => {
    const many = structuredClone(payload);
    many.deliveries = Array.from({ length: 1201 }, (_, index) => ({ ...payload.deliveries[0], id: id(1000 + index) }));
    const report = projectEpiReport(many, "history", all, "entrega");
    expect(report.events).toHaveLength(1201);
    await expect(buildEpiReport3ePdf(report)).rejects.toThrow("Relatório muito extenso.");
    expect(epiReportFailure(new Error("Relatório muito extenso. Escolha um período menor.")).status).toBe(422);
  });
  it("distingue ficha atual de linha do tempo e não cria entrega ao confirmar", () => {
    const current = projectEpiReport(payload, "current", all);
    const history = projectEpiReport(payload, "history", all);
    expect(current.current).toHaveLength(2);
    expect(current.current[0].feedbackLabel).toContain("confirmado");
    expect(current.current[1].feedbackLabel).toContain("pendente");
    expect(history.events.filter(event => event.kind === "entrega")).toHaveLength(2);
    expect(history.events.filter(event => event.kind === "confirmacao")).toHaveLength(1);
    expect(history.events.filter(event => event.id === "exchange-" + id(6))).toHaveLength(1);
  });
  it("respeita todos os atalhos de período e valida datas", () => {
    expect(resolveEpiPeriod({ preset: "today" }, now).from).toBe("2026-09-29");
    expect(resolveEpiPeriod({ preset: "week" }, now).from).toBe("2026-09-28");
    expect(resolveEpiPeriod({ preset: "month" }, now).from).toBe("2026-09-01");
    expect(resolveEpiPeriod({ preset: "30days" }, now).from).toBe("2026-08-31");
    expect(resolveEpiPeriod({ preset: "year" }, now).from).toBe("2026-01-01");
    expect(all.from).toBeNull();
    expect(() => resolveEpiPeriod({ preset: "custom", from: "2026-09-30", to: "2026-09-01" }, now)).toThrow();
    expect(() => resolveEpiPeriod({ preset: "custom", from: "2026-02-30", to: "2026-03-01" }, now)).toThrow();
  });
  it("evento no período referencia origem fora sem contar entrega antiga", () => {
    const period = resolveEpiPeriod({ preset: "custom", from: "2026-09-01", to: "2026-09-30" }, now);
    const report = projectEpiReport(payload, "history", period);
    expect(report.events.some(event => event.id === "delivery-" + id(2))).toBe(false);
    expect(report.events.some(event => event.details.some(detail => detail.includes("10/01/2026")))).toBe(true);
    expect(report.events.filter(event => event.kind === "entrega")).toHaveLength(1);
    expect(projectEpiReport(payload, "history", period, "divergencia").events.every(event => event.kind === "divergencia")).toBe(true);
    expect(projectEpiReport(payload, "history", resolveEpiPeriod({ preset: "today" }, now)).events).toHaveLength(0);
  });
  it("não fabrica snapshot legado e usa CA histórico", () => {
    const old = structuredClone(payload);
    old.deliveries[0].legacy_name = true;
    old.deliveries[0].legacy_unit = true;
    const report = projectEpiReport(old, "history", all);
    expect(report.legacyCount).toBe(1);
    expect(report.events.find(event => event.id === "delivery-" + id(2))?.details).toEqual(
      expect.arrayContaining([expect.stringContaining("sem snapshot histórico"), "CA registrado na entrega: CA-12345"]));
  });
  it("apresenta textos humanos e preserva IDs e unidades históricos no DTO", () => {
    const report = projectEpiReport(payload, "history", all);
    const details = report.events.flatMap(event => event.details).join("\n");
    expect(details).toContain("Motivo: Desgaste");
    expect(details).toContain("Categoria: Tamanho diferente");
    expect(details).not.toMatch(/DESGASTE|TAMANHO/);
    expect(details).not.toContain(id(3));
    expect(details).not.toContain(id(7));
    expect(details).toContain("Entrega 001");
    expect(epiReportResponsible(payload.deliveries[0])).toContain("não registrado nominalmente no histórico");
    expect(epiReportResponsible({ ...payload.deliveries[0], responsible_name_snapshot: "Gestão Sintética (snapshot)" }))
      .toBe("Responsável pela entrega: Gestão Sintética (snapshot)");
    expect(report.payload.deliveries[0].responsible_id).toBe(id(7));
    expect(report.payload.deliveries[0].unit).toBe("un");
    expect(epiReportQuantity(1, "par")).toBe("1 par");
    expect(epiReportQuantity(2, "par")).toBe("2 pares");
    expect(epiReportQuantity(1, "un")).toBe("1 unidade");
    expect(epiReportQuantity(2, "un")).toBe("2 unidades");
  });
  it("referências da entrega continuam iguais no relatório filtrado", () => {
    const full = projectEpiReport(payload, "history", all);
    const partial = projectEpiReport(payload, "history", resolveEpiPeriod({ preset: "month" }, now));
    const pick = (report: typeof full) => report.events.find(event => event.id === `delivery-${id(4)}`)?.details;
    expect(pick(partial)).toEqual(pick(full));
    expect(pick(partial)).toContain("Entrega anterior relacionada: 10/01/2026, 09:00 (Entrega 001)");
  });
  it("EPI diferente no vínculo não é apresentado como atendimento automático da troca", () => {
    const changed = structuredClone(payload);
    changed.deliveries[1].item_id = id(21);
    changed.deliveries[1].item_name = "Luva sintética incompatível";
    const report = projectEpiReport(changed, "history", all);
    const delivery = report.events.find(event => event.id === `delivery-${id(4)}`)!;
    expect(delivery.title).toContain("incompatível");
    expect(delivery.details.join(" ")).toContain("não comprova atendimento à solicitação");
    expect(report.events.find(event => event.title === "Troca aprovada")?.details.join(" "))
      .toContain("não comprova atendimento desta troca");
    changed.deliveries[1].item_id = id(20); // mesmo item pode ter snapshot nominal diferente
    expect(projectEpiReport(changed, "history", all).events.find(event => event.id === `delivery-${id(4)}`)?.title)
      .toBe("Entrega vinculada a pedido de troca");
  });
  it("separa troca de outros encerramentos e mantém nome extenso paginado", async () => {
    const changed = structuredClone(payload);
    changed.deliveries[0].status = "damaged";
    changed.deliveries[0].closed_at = "2026-09-18T12:00:00Z";
    changed.deliveries[0].item_name = "EPI sintético com descrição extensa. ".repeat(500);
    const report = projectEpiReport(changed, "history", all);
    expect(report.events.find(event => event.id === "close-" + id(2))?.kind).toBe("encerramento");
    expect(projectEpiReport(changed, "history", all, "troca").events.some(event => event.id === "close-" + id(2))).toBe(false);
    const pdf = await PDFDocument.load(await buildEpiReport3ePdf(report));
    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });
  it("via impressa contém apenas fornecimentos sem modificar a trilha completa", async () => {
    const raw = structuredClone(payload);
    const report = projectEpiReport(raw, "history", all);
    const before = structuredClone(report);
    const printed = epiPrintedSupplies(report);
    expect(printed).toEqual([
      { title: "ENTREGA", at: raw.deliveries[0].delivered_at, item: "Capacete sintético", ca: "12345",
        quantity: "1 unidade", responsible: "Não registrado",
        receipt: `Recebimento confirmado pelo funcionário no portal em ${reportDate("2026-01-10T13:00:00Z")}` },
      { title: "ENTREGA PARA TROCA", at: raw.deliveries[1].delivered_at, item: "Capacete sintético", ca: "67890",
        quantity: "2 unidades", responsible: "Não registrado",
        receipt: "Divergência resolvida; confirmação pendente" },
    ]);
    expect(JSON.stringify(printed)).not.toMatch(/00000000-|Grupo 00|Entrega 00|DESGASTE|TAMANHO|L-9|Marca de teste/);
    await buildEpiReport3ePdf(report);
    expect(report).toEqual(before);
    expect(raw).toEqual(payload);
    expect(report.payload.deliveries[0]).toMatchObject({ lot: "L-9", brand: "Marca de teste",
      group_id: id(3), responsible_id: id(7), employee_name_snapshot: "João Sintético", profession_snapshot: "Montador" });
    expect(report.payload.feedback).toEqual(payload.feedback);
    expect(report.payload.exchanges).toEqual(payload.exchanges);
    expect(report.events.some(event => event.kind === "confirmacao")).toBe(true);
    expect(report.events.some(event => event.kind === "divergencia")).toBe(true);
  });
  it("fornecimentos usam período inclusivo de Fortaleza e não contam confirmação como entrega", () => {
    const raw = structuredClone(payload);
    raw.deliveries = ["2026-09-01T02:59:59Z", "2026-09-01T03:00:00Z", "2026-10-01T02:59:59Z", "2026-10-01T03:00:00Z"]
      .map((at, index) => ({ ...payload.deliveries[0], id: id(800 + index), delivered_at: at }));
    const period = resolveEpiPeriod({ preset: "custom", from: "2026-09-01", to: "2026-09-30" }, now);
    expect(epiPrintedSupplies(projectEpiReport(raw, "history", period)).map(row => row.at))
      .toEqual(["2026-09-01T03:00:00Z", "2026-10-01T02:59:59Z"]);
    const feedbackOnly = resolveEpiPeriod({ preset: "custom", from: "2026-09-16", to: "2026-09-17" }, now);
    const report = projectEpiReport(payload, "history", feedbackOnly);
    expect(report.events).toHaveLength(2);
    expect(epiPrintedSupplies(report)).toHaveLength(0);
    const month = resolveEpiPeriod({ preset: "month" }, now);
    const technical = projectEpiReport(payload, "history", month, "divergencia");
    expect(technical.events.every(event => event.kind === "divergencia")).toBe(true);
    expect(epiPrintedSupplies(technical).map(row => row.title)).toEqual(["ENTREGA PARA TROCA"]);
  });
  it("substituição impressa exige entrega real compatível, não somente aprovação ou vínculo", () => {
    const raw = structuredClone(payload);
    raw.deliveries = [payload.deliveries[0]];
    expect(epiPrintedSupplies(projectEpiReport(raw, "history", all)).map(row => row.title)).toEqual(["ENTREGA"]);
    raw.deliveries = structuredClone(payload.deliveries);
    raw.deliveries[1].item_id = id(21);
    expect(epiPrintedSupplies(projectEpiReport(raw, "history", all))[1].title).toBe("ENTREGA");
    raw.deliveries[1].item_id = id(20);
    raw.exchanges[0].new_group_id = id(90);
    expect(epiPrintedSupplies(projectEpiReport(raw, "history", all))[1].title).toBe("ENTREGA");
    raw.exchanges[0].new_group_id = id(5);
    raw.deliveries[1].reason = "initial";
    expect(epiPrintedSupplies(projectEpiReport(raw, "history", all))[1].title).toBe("ENTREGA");
    raw.deliveries[1].reason = "replacement";
    expect(epiPrintedSupplies(projectEpiReport(raw, "history", all))[1].title).toBe("ENTREGA PARA TROCA");
    raw.deliveries[0].status = "replaced";
    raw.deliveries[0].closed_at = raw.deliveries[1].delivered_at;
    expect(epiPrintedSupplies(projectEpiReport(raw, "history", all))[1].title).toBe("SUBSTITUIÇÃO");
    raw.deliveries = [raw.deliveries[1]];
    expect(epiPrintedSupplies(projectEpiReport(raw, "history", all))[0].title).toBe("ENTREGA");
  });
  it("PDF respeita current_status e closed_at do contrato, sem baixar o anterior por inferência", async () => {
    const raw = structuredClone(payload);
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      const unchanged = structuredClone(raw);
      const current = projectEpiReport(raw, "current", all);
      expect(current.current.map(row => row.id)).toEqual(raw.deliveries.filter(row => row.status === "active").map(row => row.id));
      await buildEpiReport3ePdf(current);
      expect(draw.mock.calls.filter(([text]) => text === "Capacete sintético")).toHaveLength(2);
      draw.mockClear();
      await buildEpiReport3ePdf(projectEpiReport(raw, "history", all));
      expect(draw.mock.calls.some(([text]) => text === "ENTREGA PARA TROCA")).toBe(true);
      expect(draw.mock.calls.some(([text]) => text === "SUBSTITUIÇÃO")).toBe(false);
      expect(raw).toEqual(unchanged);

      // Outro estado de entrada, com encerramento já registrado: não é escrita no banco.
      const closed = structuredClone(raw);
      closed.deliveries[0].status = "replaced";
      closed.deliveries[0].closed_at = closed.deliveries[1].delivered_at;
      const saved = structuredClone(closed);
      const closedCurrent = projectEpiReport(closed, "current", all);
      expect(closedCurrent.current.map(row => row.id)).toEqual([id(4)]);
      draw.mockClear();
      await buildEpiReport3ePdf(closedCurrent);
      expect(draw.mock.calls.filter(([text]) => text === "Capacete sintético")).toHaveLength(1);
      draw.mockClear();
      const period = resolveEpiPeriod({ preset: "month" }, now);
      await buildEpiReport3ePdf(projectEpiReport(closed, "history", period));
      expect(draw.mock.calls.some(([text]) => text === "SUBSTITUIÇÃO")).toBe(true);
      expect(closed).toEqual(saved);
      expect(raw).toEqual(unchanged);
    } finally { draw.mockRestore(); }
  });
  it("não declara substituição com encerramento ausente, posterior ou de outra natureza", () => {
    const raw = structuredClone(payload);
    for (const [status, at] of [
      ["active", null], ["active", raw.deliveries[1].delivered_at], ["replaced", null],
      ["replaced", "2026-09-16T12:00:00Z"], ["replaced", "2026-01-09T12:00:00Z"],
      ["returned", raw.deliveries[1].delivered_at], ["damaged", raw.deliveries[1].delivered_at],
    ] as const) {
      raw.deliveries[0].status = status;
      raw.deliveries[0].closed_at = at;
      const saved = structuredClone(raw);
      const report = projectEpiReport(raw, "history", all);
      expect(epiPrintedSupplies(report)[1].title).toBe("ENTREGA PARA TROCA");
      expect(projectEpiReport(raw, "current", all).current.map(row => row.id))
        .toEqual(raw.deliveries.filter(row => row.status === "active").map(row => row.id));
      expect(raw).toEqual(saved);
    }
    raw.deliveries[1].exchange_request_id = null;
    expect(epiPrintedSupplies(projectEpiReport(raw, "history", all))[1].title).toBe("ENTREGA PARA TROCA");
  });
  it("via impressa não mostra tamanho/variante (decisão de 03/10) e só imprime responsável nominal histórico", () => {
    const raw = structuredClone(payload);
    raw.deliveries[0].responsible_name_snapshot = "  Gestão Sintética (snapshot)  ";
    raw.deliveries[1].responsible_name_snapshot = "  ";
    const printed = epiPrintedSupplies(projectEpiReport(raw, "current", all));
    expect(printed[0]).toMatchObject({ responsible: "Gestão Sintética (snapshot)" }); expect(printed[0]).not.toHaveProperty("variant");
    expect(printed[1]).toMatchObject({ responsible: "Não registrado" }); expect(JSON.stringify(printed)).not.toMatch(/"M"|"58"/);
    expect(JSON.stringify(printed)).not.toContain(id(7));
    raw.deliveries[0].status = "replaced";
    raw.deliveries[0].closed_at = "2026-09-15T12:00:00Z";
    expect(epiPrintedSupplies(projectEpiReport(raw, "current", all))).toHaveLength(1);
    expect(epiPrintedSupplies(projectEpiReport(raw, "history", all))).toHaveLength(2);
  });
  it("CA humano evita prefixo repetido e preserva o snapshot e zeros iniciais", () => {
    const cases: Array<[string | null, string]> = [
      ["CA-12345", "12345"], ["12345", "12345"], ["CA: 12345", "12345"],
      ["ca 12345", "12345"], ["CA-00123", "00123"], ["CA-3E-HIST", "CA-3E-HIST"],
      [null, "Não registrado"], ["  ", "Não registrado"],
    ];
    for (const [original, visible] of cases) {
      const raw = structuredClone(payload);
      raw.deliveries = [{ ...raw.deliveries[0], ca: original }];
      for (const type of ["current", "history"] as const) {
        const report = projectEpiReport(raw, type, all);
        expect(epiPrintedSupplies(report)[0].ca).toBe(visible);
        expect(report.payload.deliveries[0].ca).toBe(original);
      }
      expect(raw.deliveries[0].ca).toBe(original);
    }
  });
  it("via impressa mostra a confirmação eletrônica de cada entrega no lugar da assinatura manuscrita", () => {
    expect(epiReceiptLabel(null, null)).toBe("Sem confirmação eletrônica registrada");
    expect(epiReceiptLabel(id(3), null)).toBe("Confirmação do funcionário pendente");
    expect(epiReceiptLabel(id(3), payload.feedback[1])).toBe("Divergência informada pelo funcionário, em andamento");
    const pending = structuredClone(payload); pending.feedback = [];
    expect(epiPrintedSupplies(projectEpiReport(pending, "current", all)).map(row => row.receipt))
      .toEqual(["Confirmação do funcionário pendente", "Confirmação do funcionário pendente"]);
  });
  it("gera A4, paginação e nome sem identificação pessoal", async () => {
    const report = projectEpiReport(payload, "current", all);
    const bytes = await buildEpiReport3ePdf(report);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPages()[0].getSize()).toMatchObject({ width: 595.28, height: 841.89 });
    expect(epiReportFilename(report)).not.toContain("João");
    const many = structuredClone(payload);
    many.deliveries = [...payload.deliveries, ...Array.from({ length: 65 }, (_, index) =>
      ({ ...payload.deliveries[0], id: id(100 + index), group_id: id(300 + index) }))];
    const pages = await PDFDocument.load(await buildEpiReport3ePdf(projectEpiReport(many, "history", all)));
    expect(pages.getPageCount()).toBeGreaterThan(1);
  });
  it("gera quatro amostras sintéticas quando solicitado", async () => {
    const directory = process.env.METALLO_3E_PDF_OUTPUT;
    if (!directory) return;
    await mkdir(directory, { recursive: true });
    const filtered = resolveEpiPeriod({ preset: "custom", from: "2026-09-01", to: "2026-09-30" }, now);
    const many = structuredClone(payload);
    many.deliveries = [...payload.deliveries, ...Array.from({ length: 65 }, (_, index) =>
      ({ ...payload.deliveries[0], id: id(100 + index), group_id: id(300 + index) }))];
    const examples = [
      ["ficha-atual-sintetica.pdf", projectEpiReport(payload, "current", all)],
      ["historico-completo-sintetico.pdf", projectEpiReport(payload, "history", all)],
      ["historico-filtrado-sintetico.pdf", projectEpiReport(payload, "history", filtered)],
      ["historico-multipagina-sintetico.pdf", projectEpiReport(many, "history", all)],
    ] as const;
    const logo = await readFile(join(process.cwd(), "public", "metallo-logo.png"));
    for (const [index, [name, report]] of examples.entries()) {
      if (process.env.METALLO_3E_PDF_SAMPLES === "history" && report.type !== "history") continue;
      report.payload.report_id = id(900 + index);
      await writeFile(join(directory, name), await buildEpiReport3ePdf(report, logo));
    }
  });
});

describe("Marco 3I - recusa e termo no relatório", () => {
  it("recusa registrada entra na trilha e na via impressa sem fingir confirmação", async () => {
    const raw = structuredClone(payload);
    raw.feedback = [{ id: 9, group_id: id(3), delivery_id: null, type: "RECUSA", category: null, at: "2026-01-11T12:00:00Z" }];
    const report = projectEpiReport(raw, "history", all);
    expect(report.events.some(event => event.title === "Recusa registrada pela Gestão")).toBe(true);
    expect(epiPrintedSupplies(report)[0].receipt).toBe("Recusa registrada pela Gestão; confirmação do funcionário pendente");
    const pdf = await PDFDocument.load(await buildEpiReport3ePdf(report, undefined, "2026-01-05T12:00:00Z"));
    expect(pdf.getPageCount()).toBeGreaterThan(0);
    await buildEpiReport3ePdf(projectEpiReport(raw, "current", all), undefined, null);
  });
});
