import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { lerQuantidade3t, meusPedidos3t } from "@/03_FUNCOES_E_LOGICA/Pedidos/pedido-material-3t";

// Marco 3T: pedir material pelo app.
it("quantidade aceita vírgula, até 2 casas, de 0,01 a 1000", () => {
  expect(lerQuantidade3t("2,5")).toBe(2.5);
  expect(lerQuantidade3t("10")).toBe(10);
  expect(lerQuantidade3t("0")).toBeNull();
  expect(lerQuantidade3t("1001")).toBeNull();
  expect(lerQuantidade3t("abc")).toBeNull();
  expect(lerQuantidade3t("1,234")).toBeNull();
});

it("resposta do banco é validada", () => {
  expect(() => meusPedidos3t.parse([{ id: 1, material: "Disco", unidade: "un", quantidade: 2, observacao: null, status: "pendente", resposta: null, created_at: "x", decided_at: null }])).toThrow();
});

it("banco: só a própria pessoa pede/cancela; recusar exige motivo; limite de 10 abertos; sem DELETE/DROP", () => {
  const sql = readFileSync("../04_BANCO_E_SUPABASE/teste-online/3t-pedido-material.sql", "utf8");
  expect(sql).toMatch(/cancel_pedido_material_3t[\s\S]{0,700}employee_id = v_emp and status = 'aberto'/);
  expect(sql).toContain("raise exception 'motivo_obrigatorio'");
  expect(sql).toContain("v_abertos >= 10");
  expect(sql).not.toMatch(/^\s*(drop|delete)\b/im);
});
