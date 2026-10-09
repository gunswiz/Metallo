import { z } from "zod";
import { getSupabaseEnv } from "@/09_CONFIGURACOES/ambienteSupabase";
import { recursosNovosLiberados } from "@/09_CONFIGURACOES/ambiente-teste-online";
import { createClient } from "./server";

// Marco 3R: contrato e valor real do equipamento alugado (só laboratório e teste online).
const detalhes = z.array(z.object({ asset_id: z.string().uuid(), contract_number: z.string().nullable(), real_value: z.coerce.number().nullable() }));
export type DetalhesAluguel3r = { contractNumber: string | null; realValue: number | null };

export function aluguelLiberado3r() { return recursosNovosLiberados(getSupabaseEnv().url); }

export async function lerDetalhesAluguel3r(): Promise<Map<string, DetalhesAluguel3r>> {
  if (!aluguelLiberado3r()) return new Map();
  const result = await (await createClient()).rpc("asset_rental_details_3r" as never);
  if (result.error) return new Map();
  return new Map(detalhes.parse(result.data).map(d => [d.asset_id, { contractNumber: d.contract_number, realValue: d.real_value }]));
}

export async function salvarDetalhesAluguel3r(assetId: string, contrato: string | null, valor: number | null) {
  const { error } = await (await createClient()).rpc("set_asset_rental_details_3r" as never,
    { p_asset_id: assetId, p_contract_number: contrato, p_real_value: valor } as never);
  return error;
}
