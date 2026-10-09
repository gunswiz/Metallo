import { z } from "zod";
import { getSupabaseEnv } from "@/09_CONFIGURACOES/ambienteSupabase";
import { recursosNovosLiberados } from "@/09_CONFIGURACOES/ambiente-teste-online";
import { createClient } from "./server";

// Marco 3Q: preços dos materiais (só laboratório e teste online). Quem não pode ver preço recebe lista vazia do banco.
const precos = z.array(z.object({ item_id: z.string().uuid(), unit_price: z.coerce.number().positive(), updated_at: z.string() }));
const materiais = z.array(z.object({ id: z.string().uuid(), code: z.string(), name: z.string(), unit: z.string(), category: z.string().nullable() }));

export function precosLiberados3q() { return recursosNovosLiberados(getSupabaseEnv().url); }

export async function lerPrecos3q() {
  if (!precosLiberados3q()) return [];
  const result = await (await createClient()).rpc("item_prices_3q" as never);
  if (result.error) return [];
  return precos.parse(result.data);
}

export async function lerMateriaisParaPreco3q() {
  const result = await (await createClient()).from("items").select("id, code, name, unit, category").eq("active", true).order("name").limit(1000);
  if (result.error) throw new Error("Não foi possível carregar os materiais.");
  return materiais.parse(result.data);
}
