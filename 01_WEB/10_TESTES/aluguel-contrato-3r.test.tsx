import { readFileSync } from "node:fs";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { lerContrato3r, lerValorEquipamento3r, mostrarReais3r } from "@/03_FUNCOES_E_LOGICA/Equipamentos/aluguel-3r";
import { EquipmentForm } from "@/02_COMPONENTES_VISUAIS/equipment-form";

afterEach(cleanup);
// Marco 3R: equipamento alugado com número do contrato e valor real do equipamento (o valor do aluguel fica de fora).
it("contrato: texto curto, sem quebra de linha; vazio pode", () => {
  expect(lerContrato3r("  2026/0458 ")).toBe("2026/0458");
  expect(lerContrato3r("CT  12   A")).toBe("CT 12 A");
  expect(lerContrato3r("")).toBeNull();
  expect(lerContrato3r("x".repeat(61))).toBeUndefined();
});

it("valor real do equipamento em R$", () => {
  expect(lerValorEquipamento3r("15.000,00")).toBe(15000);
  expect(lerValorEquipamento3r("R$ 8.500")).toBe(8500);
  expect(lerValorEquipamento3r("")).toBeNull();
  expect(lerValorEquipamento3r("abc")).toBeUndefined();
  expect(lerValorEquipamento3r("0")).toBeUndefined();
  expect(mostrarReais3r(15000)).toMatch(/^R\$\s15\.000,00$/);
  expect(mostrarReais3r(null)).toBe("Não informado");
});

it("formulário: campos aparecem só para alugado e deixam claro que não é o aluguel", () => {
  render(<EquipmentForm action={async () => {}} teams={[{ id: "t", name: "Equipe" }]} mode="create" extrasAluguel />);
  expect(screen.queryByLabelText(/Número do contrato/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Tipo de propriedade"), { target: { value: "rented" } });
  expect(screen.getByLabelText(/Número do contrato/)).toBeInTheDocument();
  expect(screen.getByLabelText(/Valor real do equipamento/)).toBeInTheDocument();
  expect(screen.getByText(/Não é o valor do aluguel/)).toBeInTheDocument();
  expect(document.querySelectorAll("input[name]").length).toBeGreaterThan(0);
  expect([...document.querySelectorAll("input[name]")].map(i => i.getAttribute("name"))).not.toContain("rentalPrice");
});

it("sem a liberação (produção), o formulário fica como antes", () => {
  render(<EquipmentForm action={async () => {}} teams={[]} mode="create" defaults={{ ownershipType: "rented" }} />);
  expect(screen.queryByLabelText(/Número do contrato/)).not.toBeInTheDocument();
});

it("o banco esconde o valor de quem não é administrador ou engenheiro", () => {
  const sql = readFileSync("../04_BANCO_E_SUPABASE/teste-online/3r-contrato-equipamento-alugado.sql", "utf8");
  expect(sql).toMatch(/p\.role in \('admin', 'engineer'\)\) then d\.real_value end/);
  expect(sql).toContain("public.can_operate('equipment:write', v_team)");
});
