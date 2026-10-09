import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { cnpjValido, cpfValido, crc16Kermit, latin1, mostrarCnpj } from "@/03_FUNCOES_E_LOGICA/Ponto/oficial-4f";

// Marco 4F: empresa, CPF e AFD (leiaute v004). Sem valor oficial no teste.
it("CPF: confere os dígitos verificadores", () => {
  expect(cpfValido("104.332.181-00")).toBe(true);
  expect(cpfValido("10433218101")).toBe(false);
  expect(cpfValido("111.111.111-11")).toBe(false);
  expect(cpfValido("123")).toBe(false);
});

it("CNPJ: confere os dígitos e formata", () => {
  expect(cnpjValido("11.222.333/0001-81")).toBe(true);
  expect(cnpjValido("11222333000182")).toBe(false);
  expect(mostrarCnpj("11222333000181")).toBe("11.222.333/0001-81");
});

it("CRC-16/KERMIT do leiaute: '123456789' gera 2189", () => {
  expect(crc16Kermit("123456789")).toBe("2189");
});

it("arquivo sai em ISO-8859-1 (acentos em 1 byte)", () => {
  expect([...latin1("Ação")]).toEqual([65, 231, 227, 111]);
  expect([...latin1("€")]).toEqual([63]);
});

it("banco: sem CPF não marca; CPF gravado na hora; hash do AFD em corrente própria; CPF só mascarado na tela", () => {
  const sql = readFileSync("../04_BANCO_E_SUPABASE/teste-online/4f-cpf-empregador-afd.sql", "utf8");
  expect(sql).toContain("raise exception 'CPF_NAO_CADASTRADO'");
  expect(sql).toContain("m.employee_cpf := v_cpf;");
  expect(sql).toContain("m.afd_hash := ponto.hash(ponto.afd_linha7(m) || coalesce(c.ultimo_afd_hash, ''));");
  expect(sql).toContain(`'YYYY-MM-DD"T"HH24:MI":00-0300"'`);
  expect(sql).toMatch(/'\*\*\*\.' \|\| substr\(c\.cpf, 4, 3\)/);
  expect(sql).not.toMatch(/returns table\([^)]*\bcpf text/);
});

it("servidor: AFD só para administrador, pela origem da Gestão, com assinatura indicada em .p7s", () => {
  const fn = readFileSync("../04_BANCO_E_SUPABASE/supabase/functions/ponto-4d/index.ts", "utf8");
  expect(fn).toMatch(/path === "\/gestao\/afd"[\s\S]{0,200}origin !== GESTAO[\s\S]{0,300}gestorAtivo\(tx, p\)/);
  expect(fn).toContain(`"ASSINATURA_DIGITAL_EM_ARQUIVO_P7S".padEnd(100, " ")`);
  expect(fn).toContain(`"004"`);
});
