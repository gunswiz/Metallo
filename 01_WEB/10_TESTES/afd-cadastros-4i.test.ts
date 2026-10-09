import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

// Marco 4I: cadastros da empresa (tipo 2) e dos funcionários (tipo 5) na mesma numeração do ponto, imutáveis e com CRC.
const sql = readFileSync("../04_BANCO_E_SUPABASE/teste-online/4i-afd-tipos-2-e-5.sql", "utf8");
const fn = readFileSync("../04_BANCO_E_SUPABASE/supabase/functions/ponto-4d/index.ts", "utf8");

it("registros de cadastro são imutáveis e usam o mesmo contador (escritor único) das marcações", () => {
  expect(sql).toContain("create or replace trigger imutavel before delete or update on ponto.evento_afd");
  expect(sql).toMatch(/registrar_evento_afd[\s\S]{0,300}from ponto\.contador_nsr where singleton for update/);
  expect(sql).toContain("update ponto.contador_nsr set ultimo_nsr = v_nsr where singleton;");
});

it("tipo 2 e tipo 5 no leiaute (CPF do responsável, operação I/A/E, nome com 52 posições)", () => {
  expect(sql).toMatch(/registrar_evento_afd\(2::smallint, ponto\.afd_n\(e\.responsavel_cpf, 14\)/);
  expect(sql).toMatch(/registrar_evento_afd\(5::smallint, p_operacao \|\| ponto\.afd_n\(p_cpf, 12\) \|\| ponto\.afd_a\(p_nome, 52\)/);
  expect(sql).toMatch(/evento_funcionario_4i\('E', v_old, v_nome\)/);
});

it("verificação cobre NSR contínuo somando marcações e cadastros, e o CRC de cada cadastro", () => {
  expect(sql).toContain("union all select e.nsr from ponto.evento_afd e");
  expect(sql).toContain("'CADASTRO_ALTERADO_NSR_'");
});

it("sem DROP na migração (o banco de teste aplica sem pedir confirmação destrutiva)", () => {
  expect(sql).not.toMatch(/^\s*drop /im);
});

it("AFD junta tipos 2, 5 e 7 por NSR e o trailer conta cada tipo", () => {
  expect(fn).toContain(".sort((a, b) => a.nsr - b.nsr).map(r => r.texto)");
  expect(fn).toContain(`"999999999" + qt(2) + N(0, 9) + N(0, 9) + qt(5) + N(0, 9) + N(linhas7.length, 9) + "9"`);
});
