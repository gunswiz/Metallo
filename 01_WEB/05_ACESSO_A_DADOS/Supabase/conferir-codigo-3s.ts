import { z } from "zod";
import { getSupabaseEnv } from "@/09_CONFIGURACOES/ambienteSupabase";
import { recursosNovosLiberados } from "@/09_CONFIGURACOES/ambiente-teste-online";
import { createClient } from "./server";

// Marco 3S: conferir o código de verificação impresso no PDF de EPI (só laboratório e teste online).
const item = z.object({ item_name: z.string(), item_code: z.string().nullable().optional(), ca: z.string().nullable().optional(), quantity: z.number(), unit: z.string(),
  size: z.string().nullable().optional() }).passthrough();
const resultado = z.array(z.object({ forma: z.enum(["digital", "senha"]), confirmado_em: z.string(), funcionario: z.string(), matricula: z.string().nullable(),
  entregue_em: z.string().nullable(), itens: z.array(item).nullable(), integro: z.boolean() }));
export type ConferenciaEpi = z.infer<typeof resultado>[number];

export function normalizarCodigo3s(codigo: string) { return codigo.replace(/[^0-9a-f]/gi, "").toLowerCase(); }
export function conferenciaLiberada3s() { return recursosNovosLiberados(getSupabaseEnv().url); }

export async function conferirCodigo3s(codigo: string): Promise<ConferenciaEpi | null | "invalido"> {
  const limpo = normalizarCodigo3s(codigo);
  if (!/^[0-9a-f]{64}$/.test(limpo)) return "invalido";
  const r = await (await createClient()).rpc("conferir_codigo_epi_3s" as never, { p_codigo: limpo } as never);
  if (r.error) throw new Error("Não foi possível conferir agora.");
  return resultado.parse(r.data)[0] ?? null;
}
