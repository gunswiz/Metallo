import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { caminhaoForm10a, caminhoesApp10a, concluirManutencaoForm10a, itensApp10a, lerCusto10a, mensagemErroFrota10a, planoForm10a } from "@/03_FUNCOES_E_LOGICA/Frota/contrato-10a";

// Marco 10A: frota de caminhões munck.
const sql = readFileSync("../04_BANCO_E_SUPABASE/teste-online/10a-frota.sql", "utf8");

it("custo aceita vírgula ou ponto e vazio vira nulo", () => {
  expect(lerCusto10a("350,50")).toBe(350.5);
  expect(lerCusto10a("1200")).toBe(1200);
  expect(lerCusto10a("")).toBeNull();
  expect(concluirManutencaoForm10a.safeParse({ veiculoId: "1", manutencaoId: "2", custo: "abc", km: "", obs: "" }).success).toBe(false);
  expect(concluirManutencaoForm10a.safeParse({ veiculoId: "1", manutencaoId: "2", custo: "350,5", km: "", obs: "" }).success).toBe(true);
});

it("placa é normalizada e precisa ter 7 caracteres", () => {
  const ok = caminhaoForm10a.safeParse({ placa: "abc-1d23", nome: "Munck 06", modelo: "", ano: "", km: "1000" });
  expect(ok.success && ok.data.placa).toBe("ABC1D23");
  expect(caminhaoForm10a.safeParse({ placa: "AB12", nome: "Munck", modelo: "", ano: "", km: "0" }).success).toBe(false);
});

it("plano exige ao menos km ou dias", () => {
  expect(planoForm10a.safeParse({ veiculoId: "1", descricao: "Óleo", cadaKm: "10000", cadaDias: "", ultimoKm: "5000", ultimaData: "" }).success).toBe(true);
  expect(planoForm10a.safeParse({ veiculoId: "1", descricao: "O", cadaKm: "", cadaDias: "", ultimoKm: "", ultimaData: "" }).success).toBe(false);
});

it("resposta do banco é validada e erros viram frases claras", () => {
  expect(() => caminhoesApp10a.parse([{ id: 1, nome: "M", placa: "X", modelo: null, situacao: "voando", km_atual: 1, checklist_hoje: null, motorista: null, destino: null, saida_em: null, minha_viagem: null }])).toThrow();
  expect(itensApp10a.parse([{ codigo: 1, nome: "Pneus", critico: true }])).toHaveLength(1);
  expect(mensagemErroFrota10a(new Error("checklist_do_dia_necessario"))).toMatch(/checklist/i);
  expect(mensagemErroFrota10a(new Error("qualquer coisa"))).toMatch(/tente de novo/i);
});

it("banco: 26 itens da planilha, tabelas fechadas e sem DELETE/DROP", () => {
  expect((sql.match(/^\s*\(\d+, '/gm) ?? []).length + (sql.match(/\(\d+, '[^']+', (true|false)\)/g) ?? []).length).toBeGreaterThanOrEqual(26);
  expect(sql).toContain("(26, 'Cintos de segurança', true)");
  expect(sql).toMatch(/revoke all on private\.frota_veiculos_10a/);
  expect(sql).toMatch(/enable row level security/);
  expect(sql).not.toMatch(/^\s*(drop|delete)\b/im);
});

it("banco: saída exige checklist do dia ou liberação e caminhão disponível; um caminhão e uma pessoa por vez", () => {
  expect(sql).toContain("raise exception 'checklist_do_dia_necessario'");
  expect(sql).toContain("raise exception 'veiculo_nao_liberado'");
  expect(sql).toContain("raise exception 'voce_ja_esta_com_um_caminhao'");
  expect(sql).toContain("frota_viagem_aberta_veiculo_10a");
  expect(sql).toContain("frota_viagem_aberta_pessoa_10a");
});

it("banco: item crítico bloqueia; cadastro e liberação só administrador e engenheiro; manutenção pela Gestão", () => {
  expect(sql).toContain("v_res := case when v_crit then 'nao_liberado'");
  expect(sql).toMatch(/admin_liberar_10a[\s\S]{0,400}frota_pode_cadastrar_10a/);
  expect(sql).toMatch(/admin_save_veiculo_10a[\s\S]{0,400}frota_pode_cadastrar_10a/);
  expect(sql).toMatch(/admin_concluir_manutencao_10a[\s\S]{0,400}pode_atender_3t/);
  expect(sql).not.toMatch(/to anon/i);
});

it("não existe localização por GPS na frota", () => {
  expect(sql).not.toMatch(/latitude|longitude|geolocation/i);
  expect(readFileSync("app/colaborador/[[...screen]]/frota.tsx", "utf8")).not.toMatch(/geolocation/i);
});

// Marco 10B: foto do defeito.
it("foto do defeito: balde privado, só JPEG/PNG, ligada a quem enviou e ao caminhão", () => {
  const fotos = readFileSync("../04_BANCO_E_SUPABASE/teste-online/10b-frota-fotos.sql", "utf8");
  expect(fotos).toContain("public = false");
  expect(fotos).toContain("array['image/jpeg', 'image/png']");
  expect(fotos).toMatch(/f\.employee_id = v_emp and f\.veiculo_id = p_veiculo/);
  expect(fotos).toContain("raise exception 'foto_invalida'");
  expect(fotos).toMatch(/revoke all on private\.frota_fotos_10b/);
  expect(fotos).not.toMatch(/^\s*(drop|delete)\b/im);
  const funcao = readFileSync("../04_BANCO_E_SUPABASE/supabase/functions/fotos-frota-10b/index.ts", "utf8");
  expect(funcao).toContain("tipoReal");
  expect(funcao).toContain("createSignedUrl(a.caminho, 120)");
  expect(funcao).not.toMatch(/console\.(log|error)\([^)]*token/i);
});

// Marco 10C: defeito vira relato na manutenção + alerta + aviso no celular da Gestão.
it("defeito informado: relato na manutenção, só a própria pessoa dispara o aviso", () => {
  const sql = readFileSync("../04_BANCO_E_SUPABASE/teste-online/10c-frota-defeitos.sql", "utf8");
  expect(sql).toContain("admin_frota_relatos_10c");
  expect(sql).toContain("avisar_defeito_frota_10c");
  expect(sql).not.toMatch(/^\s*(drop|delete)\b/im);
  const funcao = readFileSync("../04_BANCO_E_SUPABASE/supabase/functions/fotos-frota-10b/index.ts", "utf8");
  expect(funcao).toContain('body.acao === "avisar" && origin === COLABORADOR');
  expect(funcao).not.toMatch(/console\.(log|error)\([^)]*(token|endpoint)/i);
});
