import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/09_CONFIGURACOES/ambienteSupabase";
import { adminCommunication3h } from "@/03_FUNCOES_E_LOGICA/Comunicados/contrato-3h";
import { createClient } from "./server";

export function requireCommunicationLab3h() {
  if (process.env.METALLO_LOCAL_PREVIEW !== "1" || getSupabaseEnv().url !== "http://127.0.0.1:54321")
    throw new Error("Marco 3H disponível somente no laboratório local.");
}
export async function readAdminCommunications3h(page: number) {
  requireCommunicationLab3h();
  const client = await createClient();
  const result = await client.rpc("admin_communications_3h" as never,
    { p_limit: 20, p_offset: (page - 1) * 20 } as never);
  if (result.error) throw result.error;
  return z.array(adminCommunication3h).parse(result.data);
}
export async function readCommunicationTargets3h() {
  requireCommunicationLab3h();
  const client = await createClient();
  const teams = await client.from("teams").select("id,name").eq("active", true).order("name").limit(1000);
  const works = await (client as unknown as SupabaseClient).from("worksites")
    .select("id,name").eq("active", true).order("name").limit(1000);
  if (teams.error || works.error) throw teams.error ?? works.error;
  const schema = z.array(z.object({ id: z.uuid(), name: z.string() }));
  return { teams: schema.parse(teams.data), works: schema.parse(works.data) };
}
