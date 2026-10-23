"use server";

import { executeValidated } from "@/03_FUNCOES_E_LOGICA/executarOperacaoValidada";
import { abrirManutencaoForm10a, cancelarManutencaoForm10a, caminhaoForm10a, concluirManutencaoForm10a, concluirPlanoForm10a, documentoForm10a, itemForm10a,
  lerCusto10a, liberarForm10a, oficinaForm10a, planoForm10a } from "@/03_FUNCOES_E_LOGICA/Frota/contrato-10a";
import { requireFrota10a } from "@/05_ACESSO_A_DADOS/Supabase/frota-10a";

// Marco 10A — Gestão da frota. Cadastro e liberação: administrador e engenheiro (a função do banco confere de novo). Manutenção e planos: quem opera equipamentos.
const paths = ["/frota", "/dashboard"];
const ficha = (id: number | string, extra = "") => `/frota/${id}?ok=1${extra}`;
const num = (v: number | "") => (v === "" ? null : v);

export async function salvarCaminhao10a(_p: unknown, formData: FormData) {
  return executeValidated({ schema: caminhaoForm10a, capability: "epi:write", formData, paths, destination: d => d.id ? ficha(d.id, "&aba=dados") : "/frota?ok=1",
    operation: (client, d) => { requireFrota10a();
      return client.rpc("admin_save_veiculo_10a" as never, { p_id: d.id === "" || d.id === undefined ? null : d.id, p_placa: d.placa, p_nome: d.nome, p_modelo: d.modelo || null,
        p_ano: num(d.ano), p_km: d.km, p_ativo: d.ativo === "on" || d.id === "" || d.id === undefined } as never); } });
}
export async function salvarDocumento10a(_p: unknown, formData: FormData) {
  return executeValidated({ schema: documentoForm10a, capability: "epi:write", formData, paths, destination: d => ficha(d.veiculoId, "&aba=documentos"),
    operation: (client, d) => { requireFrota10a();
      return client.rpc("admin_save_documento_10a" as never, { p_veiculo: d.veiculoId, p_tipo: d.tipo, p_descricao: d.descricao || null, p_numero: d.numero || null, p_vencimento: d.vencimento } as never); } });
}
export async function salvarItem10a(_p: unknown, formData: FormData) {
  return executeValidated({ schema: itemForm10a, capability: "epi:write", formData, paths: ["/frota", "/frota/itens"], destination: "/frota/itens?ok=1",
    operation: (client, d) => { requireFrota10a();
      return client.rpc("admin_set_item_10a" as never, { p_codigo: num(d.codigo), p_nome: d.nome, p_critico: d.critico === "on", p_ativo: d.ativo === "on" || d.codigo === "" } as never); } });
}
export async function liberarCaminhao10a(_p: unknown, formData: FormData) {
  return executeValidated({ schema: liberarForm10a, capability: "epi:write", formData, paths, destination: d => ficha(d.veiculoId),
    operation: (client, d) => { requireFrota10a(); return client.rpc("admin_liberar_10a" as never, { p_veiculo: d.veiculoId, p_motivo: d.motivo } as never); } });
}
export async function abrirManutencao10a(_p: unknown, formData: FormData) {
  return executeValidated({ schema: abrirManutencaoForm10a, capability: "equipment:write", formData, paths, destination: d => ficha(d.veiculoId),
    operation: (client, d) => { requireFrota10a();
      return client.rpc("admin_abrir_manutencao_10a" as never, { p_veiculo: d.veiculoId, p_tipo: d.tipo, p_descricao: d.descricao, p_bloquear: d.bloquear === "on" } as never); } });
}
export async function enviarOficina10a(_p: unknown, formData: FormData) {
  return executeValidated({ schema: oficinaForm10a, capability: "equipment:write", formData, paths, destination: d => ficha(d.veiculoId),
    operation: (client, d) => { requireFrota10a();
      return client.rpc("admin_enviar_oficina_10a" as never, { p_id: d.manutencaoId, p_oficina: d.oficina, p_previsao: d.previsao || null } as never); } });
}
export async function concluirManutencao10a(_p: unknown, formData: FormData) {
  return executeValidated({ schema: concluirManutencaoForm10a, capability: "equipment:write", formData, paths, destination: d => ficha(d.veiculoId),
    operation: (client, d) => { requireFrota10a();
      return client.rpc("admin_concluir_manutencao_10a" as never, { p_id: d.manutencaoId, p_custo: lerCusto10a(d.custo), p_km: num(d.km), p_obs: d.obs || null } as never); } });
}
export async function cancelarManutencao10a(_p: unknown, formData: FormData) {
  return executeValidated({ schema: cancelarManutencaoForm10a, capability: "equipment:write", formData, paths, destination: d => ficha(d.veiculoId),
    operation: (client, d) => { requireFrota10a(); return client.rpc("admin_cancelar_manutencao_10a" as never, { p_id: d.manutencaoId, p_motivo: d.motivo } as never); } });
}
export async function salvarPlano10a(_p: unknown, formData: FormData) {
  return executeValidated({ schema: planoForm10a, capability: "equipment:write", formData, paths, destination: d => ficha(d.veiculoId, "&aba=planos"),
    operation: (client, d) => { requireFrota10a();
      return client.rpc("admin_save_plano_10a" as never, { p_id: d.id === "" || d.id === undefined ? null : d.id, p_veiculo: d.veiculoId, p_descricao: d.descricao, p_cada_km: num(d.cadaKm),
        p_cada_dias: num(d.cadaDias), p_ultimo_km: num(d.ultimoKm), p_ultima_data: d.ultimaData || null, p_ativo: d.ativo === "on" || d.id === "" || d.id === undefined } as never); } });
}
export async function concluirPlano10a(_p: unknown, formData: FormData) {
  return executeValidated({ schema: concluirPlanoForm10a, capability: "equipment:write", formData, paths, destination: d => ficha(d.veiculoId, "&aba=planos"),
    operation: (client, d) => { requireFrota10a();
      return client.rpc("admin_concluir_plano_10a" as never, { p_plano: d.planoId, p_km: num(d.km), p_data: d.data || null, p_custo: lerCusto10a(d.custo), p_obs: d.obs || null } as never); } });
}
