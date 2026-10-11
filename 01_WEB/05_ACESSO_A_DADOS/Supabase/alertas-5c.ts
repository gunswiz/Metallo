import "server-only";
import { z } from "zod";
import { createClient } from "./server";
import { getSupabaseEnv } from "@/09_CONFIGURACOES/ambienteSupabase";
import { recursosNovosLiberados } from "@/09_CONFIGURACOES/ambiente-teste-online";

// Marco 5D: validade do CA do EPI e vencimentos de EPI (CA e lote) para o "Precisa de você". Só laboratório e teste online.
const validades = z.array(z.object({ item_id: z.string().uuid(), validade: z.string() }));
const vencimentos = z.array(z.object({ grupo: z.enum(["CA", "LOTE"]), texto: z.string(), vence_em: z.string() }));
export type VencimentoEpi5d = z.infer<typeof vencimentos>[number];

export async function lerValidadeCa5d(itemId: string): Promise<string | null | undefined> {
  if (!recursosNovosLiberados(getSupabaseEnv().url)) return undefined;
  const r = await (await createClient()).rpc("ca_validades_5d" as never);
  if (r.error) return undefined;
  return validades.parse(r.data).find(v => v.item_id === itemId)?.validade ?? null;
}
export async function lerVencimentosEpi5d(): Promise<VencimentoEpi5d[] | null> {
  if (!recursosNovosLiberados(getSupabaseEnv().url)) return null;
  const r = await (await createClient()).rpc("vencimentos_epi_5d" as never);
  return r.error ? null : vencimentos.parse(r.data);
}
