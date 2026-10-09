import { z } from "zod";
import { getSupabaseEnv } from "@/09_CONFIGURACOES/ambienteSupabase";
import { recursosNovosLiberados } from "@/09_CONFIGURACOES/ambiente-teste-online";
import { createClient } from "./server";

// Marco 3P: equipes (que este usuário pode lançar) sem consumo lançado hoje. Só laboratório e teste online.
const equipesSemConsumo = z.array(z.object({ team_id: z.string().uuid(), team_name: z.string() }));

/** Hora (0–23) em Fortaleza. O lembrete só aparece no Início a partir das 14h, para não virar ruído de manhã. */
export function horaFortaleza(agora = new Date()) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Fortaleza", hour: "numeric", hourCycle: "h23" }).format(agora));
}

/** Domingo em Fortaleza não tem lembrete (o agendamento é de segunda a sábado). */
export function domingoEmFortaleza(agora = new Date()) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Fortaleza", weekday: "short" }).format(agora) === "Sun";
}

export async function lerEquipesSemConsumoHoje3p() {
  if (!recursosNovosLiberados(getSupabaseEnv().url)) return null;
  const result = await (await createClient()).rpc("my_teams_without_consumption_today_3p" as never);
  if (result.error) return null;
  return equipesSemConsumo.parse(result.data);
}
