import { describe, expect, it } from "vitest";
import { accountCreateSchema, batchDeliverySchema, confirmedIdSchema, emailUpdateSchema, kitSchema, movementEditSchema, requestEpiSchema } from "@/03_FUNCOES_E_LOGICA/validarParidadeMobile";
import { compatibleRequestBatches, recommendedKit } from "@/03_FUNCOES_E_LOGICA/kitDoFuncionario";

const id = "731cb0c4-c5ea-4fad-ab2e-fc632fdd39e4";
const line = { item_id: id, stock_batch_id: id, quantity: 2 };
describe("contratos dos fluxos trazidos do mobile", () => {
  it("limita solicitações ao contrato de 100 unidades", () => {
    for (const quantity of [0, -1, 1.5, 101, "inválido"]) expect(requestEpiSchema.safeParse({ employeeId: id, itemId: id, quantity }).success).toBe(false);
    expect(requestEpiSchema.parse({ employeeId: id, itemId: id, quantity: "100" }).quantity).toBe(100);
  });
  it("rejeita lotes duplicados, lista vazia e JSON inválido", () => {
    for (const lines of ["{", "[]", JSON.stringify([line, line]), JSON.stringify([{ ...line, quantity: 0 }])]) {
      expect(batchDeliverySchema.safeParse({ employeeId: id, lines, reason: "initial" }).success).toBe(false);
    }
    expect(batchDeliverySchema.parse({ employeeId: id, lines: JSON.stringify([line]), reason: "initial" }).lines).toEqual([line]);
  });
  it("permite kit vazio explícito, mas não repete itens", () => {
    expect(kitSchema.parse({ employeeId: id, lines: "[]" }).lines).toEqual([]);
    expect(kitSchema.safeParse({ employeeId: id, lines: JSON.stringify([line, line]) }).success).toBe(false);
  });
  it("exige confirmação para desativar e e-mails iguais", () => {
    expect(confirmedIdSchema.safeParse({ id }).success).toBe(false);
    expect(confirmedIdSchema.safeParse({ id, confirmation: "on" }).success).toBe(true);
    expect(emailUpdateSchema.safeParse({ email: "a@example.com", confirmation: "b@example.com" }).success).toBe(false);
  });
  it("não envia papel admin ao serviço de provisionamento", () => {
    const account = { fullName: "Pessoa Teste", email: "p@example.com", password: "SenhaSegura#2026", role: "leader", teamId: id };
    expect(accountCreateSchema.safeParse(account).success).toBe(true);
    expect(accountCreateSchema.safeParse({ ...account, role: "admin" }).success).toBe(false);
  });
  it("distingue entrada externa, transferência inválida e equipamento", () => {
    expect(movementEditSchema.safeParse({ id, kind: "material", quantity: 2, destinationTeamId: id }).success).toBe(true);
    expect(movementEditSchema.safeParse({ id, kind: "material", quantity: 2, originTeamId: id, destinationTeamId: id }).success).toBe(false);
    expect(movementEditSchema.safeParse({ id, kind: "equipment", destinationTeamId: id }).success).toBe(false);
  });
  it("mantém kits por profissão, fardamento e ferramentas pessoais", () => {
    expect(recommendedKit("encarregado").get("FARD-AZUL")).toBe(2);
    expect(recommendedKit("montador").get("PES-TRENA")).toBe(1);
    expect(recommendedKit("soldador").get("EPI-MASC-SOLDA")).toBe(1);
    expect(recommendedKit("operador de munck").has("EPI-CAP")).toBe(false);
    expect(recommendedKit("pintor").get("EPI-RESP-PINT")).toBe(1);
  });
  it("atende apenas com item, variante e estoque compatíveis", () => {
    const batches = [
      { item_id: id, variant: "40", quantity: 2 },
      { item_id: id, variant: "41", quantity: 5 },
      { item_id: id, variant: "40", quantity: 1 },
      { item_id: "outro", variant: "40", quantity: 9 },
    ];
    expect(compatibleRequestBatches({ item_id: id, requested_variant: "40", quantity: 2 }, batches)).toEqual([batches[0]]);
    expect(compatibleRequestBatches({ item_id: id, requested_variant: null, quantity: 2 }, batches)).toEqual(batches.slice(0, 2));
  });
});
