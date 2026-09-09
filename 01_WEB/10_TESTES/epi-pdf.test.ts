import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import type { EpiDeliveryReportRow } from "@/05_ACESSO_A_DADOS/Repositorios/metallo-repository";
import { buildEpiMovementPdf, epiReportFilename } from "@/03_FUNCOES_E_LOGICA/Relatorios/epi-pdf";

const delivery: EpiDeliveryReportRow = {
  id: "03088d3c-a98e-49a9-8c40-f93a018720a0",
  quantity: 1,
  delivered_at: "2026-09-03T13:43:00Z",
  delivered_by: "1db70c36-bfbb-4518-a030-b9630aad66e8",
  closed_at: null,
  closed_by: null,
  current_status: "active",
  delivery_reason: "initial",
  variant_snapshot: "Claro",
  ca_snapshot: "12345",
  brand_model_snapshot: "Modelo teste",
  lot_snapshot: "LOTE-01",
  note: "Entrega conferida pelo responsável",
  epi_items: { name: "Óculos de proteção", code: "EPI-OCU", item_kind: "epi", unit: "un" },
  epi_employees: { id: "23f772f3-6e66-4d92-a8f8-8a004a4282f8", full_name: "João da Silva", registration_code: "00045", profession: "Montador" },
  teams: { id: "8358b280-5be2-4f80-acd2-b4954030c069", name: "Equipe Wellington" },
};

describe("relatório PDF de EPI", () => {
  it("gera um PDF detalhado, paginado e com metadados", async () => {
    const bytes = await buildEpiMovementPdf({
      deliveries: Array.from({ length: 18 }, (_, index) => ({ ...delivery, id: crypto.randomUUID(), note: `Conferência ${index + 1}` })),
      actorNames: { [delivery.delivered_by]: "Administrador" },
      from: new Date("2026-09-01T03:00:00Z"),
      toInclusive: new Date("2026-09-30T03:00:00Z"),
      teamName: "Equipe Wellington",
      generatedBy: "Administrador",
      generatedAt: new Date("2026-09-07T15:00:00-03:00"),
    });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    expect(pdf.getTitle()).toBe("Relatório detalhado de movimentações de EPI");
    expect(pdf.getPages()[0].getWidth()).toBeGreaterThan(pdf.getPages()[0].getHeight());
  });

  it("gera relatório válido também quando não há movimentações", async () => {
    const bytes = await buildEpiMovementPdf({
      deliveries: [],
      actorNames: {},
      from: new Date("2026-09-01T03:00:00Z"),
      toInclusive: new Date("2026-09-30T03:00:00Z"),
      teamName: "Todas as equipes",
      generatedBy: "Administrador",
      generatedAt: new Date("2026-09-07T15:00:00-03:00"),
    });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    expect(epiReportFilename(new Date("2026-09-01T03:00:00Z"), new Date("2026-09-30T03:00:00Z")))
      .toBe("relatorio-epi-2026-09-01-a-2026-09-30.pdf");
  });
});
