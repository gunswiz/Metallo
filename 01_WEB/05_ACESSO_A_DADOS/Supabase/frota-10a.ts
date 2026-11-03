import { getSupabaseEnv } from "@/09_CONFIGURACOES/ambienteSupabase";
import { recursosNovosLiberados } from "@/09_CONFIGURACOES/ambiente-teste-online";
import { atencaoGestao10a, checklistDetalhe10a, fichaGestao10a, fotosChegadaGestao10b, itensGestao10a, mesGestao10a, painelGestao10a, relatorioGestao10d, relatosGestao10c } from "@/03_FUNCOES_E_LOGICA/Frota/contrato-10a";
import { createClient } from "./server";
import { recusasGestao10e } from "@/03_FUNCOES_E_LOGICA/Frota/contrato-10a";
import { modelosGestao10g, categoriaVeiculo10h, aprovacoesModelo10i, ativacaoModelo10j } from "@/03_FUNCOES_E_LOGICA/Frota/modelos-10g";
import { condutoresGestao10k } from "@/03_FUNCOES_E_LOGICA/Frota/condutores-10k";

// Marco 10A: frota. Somente laboratório e teste online (produção ainda não tem estas funções).
export function requireFrota10a() {
  if (!recursosNovosLiberados(getSupabaseEnv().url)) throw new Error("Frota disponível somente no ambiente de teste.");
}
async function chamar(nome: string, args?: Record<string, unknown>) {
  requireFrota10a();
  const r = await (await createClient()).rpc(nome as never, args as never);
  if (r.error) throw r.error;
  return r.data;
}
export const lerPainelFrota10a = async () => painelGestao10a.parse(await chamar("admin_frota_painel_10a"));
export const lerCondutores10k = async (employee?: string) => condutoresGestao10k.parse(await chamar("admin_condutores_10k", {p_employee: employee ?? null}));
export const lerAtencaoFrota10a = async () => atencaoGestao10a.parse(await chamar("admin_frota_atencao_10a"));
export const lerItensFrota10a = async () => itensGestao10a.parse(await chamar("admin_frota_itens_10a"));
export const lerModelosFrota10g = async (categoria: string, revisao?: number) => modelosGestao10g.parse(await chamar("admin_modelos_frota_10g", { p_categoria: categoria, p_revisao: revisao ?? null }));
export const lerCategoriaVeiculo10h = async (id: number) => categoriaVeiculo10h.parse(await chamar("admin_categoria_veiculo_10h",{p_veiculo:id}));
export const lerAprovacoesModelo10i = async(categoria:string)=>aprovacoesModelo10i.parse(await chamar("admin_aprovacoes_modelo_10i",{p_categoria:categoria}));
export const lerAtivacaoModelo10j = async(categoria:string)=>ativacaoModelo10j.parse(await chamar("admin_ativacao_modelo_10j",{p_categoria:categoria}));
export const lerFichaFrota10a = async (id: number) => fichaGestao10a.parse(await chamar("admin_frota_ficha_10a", { p_veiculo: id }));
export const lerChecklistFrota10a = async (id: number) => checklistDetalhe10a.parse(await chamar("admin_frota_checklist_10a", { p_id: id }));
export const lerMesFrota10a = async (id: number, mes: string) => mesGestao10a.parse(await chamar("admin_frota_mes_10a", { p_veiculo: id, p_mes: mes }));
export const lerFotosChegadaFrota10b = async (id: number) => fotosChegadaGestao10b.parse(await chamar("admin_frota_fotos_chegada_10b", { p_veiculo: id }));
export const lerRelatosFrota10c = async (id: number) => relatosGestao10c.parse(await chamar("admin_frota_relatos_10c", { p_veiculo: id }));
export const lerRecusasFrota10e = async (id: number) => recusasGestao10e.parse(await chamar("admin_relatos_recusados_10e", { p_veiculo: id }));
export const lerRelatorioFrota10d = async (mes: string) => relatorioGestao10d.parse(await chamar("admin_frota_relatorio_10d", { p_mes: `${mes}-01` }));
