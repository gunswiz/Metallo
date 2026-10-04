import { z } from "zod";
import { getSupabaseEnv } from "@/09_CONFIGURACOES/ambienteSupabase";
import { recursosNovosLiberados } from "@/09_CONFIGURACOES/ambiente-teste-online";
import { catalogo5a, fichaGestao5a } from "@/03_FUNCOES_E_LOGICA/Treinamentos/contrato-5a";
import { createClient } from "./server";

// Marco 5A: somente laboratório e teste online (produção ainda não tem estas funções).
export function requireTreinamentos5a() {
  if (!recursosNovosLiberados(getSupabaseEnv().url)) throw new Error("Treinamentos disponíveis somente no ambiente de teste.");
}
export async function lerVisaoTreinamentos5a() {
  requireTreinamentos5a();
  const result = await (await createClient()).rpc("admin_trainings_overview_5a" as never);
  if (result.error) throw result.error;
  return z.array(fichaGestao5a).parse(result.data);
}
export async function lerCatalogoTreinamentos5a() {
  requireTreinamentos5a();
  const result = await (await createClient()).rpc("admin_training_catalog_5a" as never);
  if (result.error) throw result.error;
  return catalogo5a.parse(result.data);
}
