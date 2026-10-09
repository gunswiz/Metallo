import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { normalizarCodigo3s } from "@/05_ACESSO_A_DADOS/Supabase/conferir-codigo-3s";
import { AVISO_LGPD, DEVERES_GESTAO } from "@/03_FUNCOES_E_LOGICA/Privacidade/aviso-lgpd";

// Marco 3S: conferir o código do PDF de EPI e aviso de privacidade (LGPD).
it("código aceita espaços e minúsculas/maiúsculas", () => {
  expect(normalizarCodigo3s("3A9F 0C21\n" + "AB".repeat(30))).toBe("3a9f0c21" + "ab".repeat(30));
});

it("banco: só perfil ativo da Gestão confere; recalcula o SHA-256 do conteúdo", () => {
  const sql = readFileSync("../04_BANCO_E_SUPABASE/teste-online/3s-conferir-codigo-epi.sql", "utf8");
  expect(sql).toContain("p.id = (select auth.uid()) and p.active");
  expect(sql).toContain("encode(pg_catalog.sha256(convert_to(x.c, 'UTF8')), 'hex') = v_hash");
  expect(sql).not.toMatch(/assertion|credential_id/);
});

it("aviso de privacidade fala da digital, da localização, dos direitos e não promete o que não faz", () => {
  const texto = AVISO_LGPD.flatMap(s => [s.titulo, ...s.itens]).join(" ");
  expect(texto).toContain("A digital nunca sai do seu celular");
  expect(texto).toContain("só no momento de marcar o ponto");
  expect(texto).toMatch(/art\. 7º, inciso II/);
  expect(texto).toContain("Pedir correção");
  expect(texto).not.toMatch(/apagamos tudo|excluímos imediatamente/i);
  expect(DEVERES_GESTAO.join(" ")).toContain("não escreva doença, CID");
});
