import { getSupabaseEnv } from "@/09_CONFIGURACOES/ambienteSupabase";
import { recursosNovosLiberados } from "@/09_CONFIGURACOES/ambiente-teste-online";
import { atencaoGestao10a, checklistDetalhe10a, fichaGestao10a, fotosChegadaGestao10b, itensGestao10a, mesGestao10a, painelGestao10a } from "@/03_FUNCOES_E_LOGICA/Frota/contrato-10a";
import { createClient } from "./server";

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
export const lerAtencaoFrota10a = async () => atencaoGestao10a.parse(await chamar("admin_frota_atencao_10a"));
export const lerItensFrota10a = async () => itensGestao10a.parse(await chamar("admin_frota_itens_10a"));
export const lerFichaFrota10a = async (id: number) => fichaGestao10a.parse(await chamar("admin_frota_ficha_10a", { p_veiculo: id }));
export const lerChecklistFrota10a = async (id: number) => checklistDetalhe10a.parse(await chamar("admin_frota_checklist_10a", { p_id: id }));
export const lerMesFrota10a = async (id: number, mes: string) => mesGestao10a.parse(await chamar("admin_frota_mes_10a", { p_veiculo: id, p_mes: mes }));
export const lerFotosChegadaFrota10b = async (id: number) => fotosChegadaGestao10b.parse(await chamar("admin_frota_fotos_chegada_10b", { p_veiculo: id }));
