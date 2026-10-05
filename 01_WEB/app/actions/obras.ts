"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { createClient } from "@/05_ACESSO_A_DADOS/Supabase/server";

// Marco 3N: "Nova obra" em uma tela só. Se pedir, cria a equipe/local que guarda o estoque junto.
const nome = z.string().trim().min(2).max(100).refine(value => !/[\u0000-\u001f]/.test(value));
export const novaObraSchema = z.discriminatedUnion("estoque", [
  z.object({ estoque: z.literal("nova"), nome, equipe: z.string().trim().max(100).optional() }),
  z.object({ estoque: z.literal("existente"), nome, equipeId: z.uuid() }),
]);

const voltar = (erro: string) => redirect(`/obras/nova?erro=${erro}`);

export async function criarObra(formData: FormData) {
  const profile = await requireCapability("admin:manage");
  const campo = (name: string) => { const value = formData.get(name); return typeof value === "string" ? value : undefined; };
  const parsed = novaObraSchema.safeParse({ estoque: campo("estoque"), nome: campo("nome"),
    equipe: campo("equipe") || undefined, equipeId: campo("equipeId") || undefined });
  if (!parsed.success) voltar(campo("estoque") === "existente" && !campo("equipeId") ? "escolha-equipe" : "dados");
  const dados = parsed.data!;
  const supabase = await createClient();
  let equipeId: string;
  if (dados.estoque === "nova") {
    const nomeEquipe = dados.equipe || `Equipe ${dados.nome}`.slice(0, 100);
    const criada = await supabase.rpc("create_team_admin", { p_name: nomeEquipe,
      p_description: `Criada junto com a obra ${dados.nome}.`.slice(0, 300), p_location_type: "field" });
    if (criada.error || typeof criada.data !== "string") voltar("equipe");
    equipeId = criada.data as string;
  } else equipeId = dados.equipeId;
  const obra = await supabase.rpc("run_site_operation", { p_command: "create_worksite",
    p_data: { name: dados.nome, team_id: equipeId, actor_id: profile.id },
    p_operation_id: randomUUID(), p_occurred_at: new Date().toISOString() });
  // Se a equipe nova foi criada e a obra falhou, a equipe fica livre e aparece em "equipe que já existe".
  if (obra.error) voltar(dados.estoque === "nova" ? "obra-equipe-criada" : "obra");
  revalidatePath("/obras"); revalidatePath("/equipes"); revalidatePath("/estoque"); revalidatePath("/dashboard");
  redirect(`/obras?criada=${encodeURIComponent(dados.nome)}`);
}
