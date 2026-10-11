"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { mesValido } from "@/03_FUNCOES_E_LOGICA/Ponto/espelho-4e";
import { createClient } from "@/05_ACESSO_A_DADOS/Supabase/server";
import { oficialLiberado4f } from "@/05_ACESSO_A_DADOS/Ponto/oficial-4f";

// Marcos 6A/6B: remover contracheque (fica no histórico) e responder atestado.
const texto = (f: FormData, k: string) => { const v = f.get(k); return typeof v === "string" ? v.trim() : ""; };

export async function removerContracheque6a(formData: FormData) {
  await requireCapability("admin:manage");
  if (!oficialLiberado4f()) redirect("/dashboard");
  const id = Number(texto(formData, "id")), competencia = texto(formData, "competencia");
  if (!Number.isInteger(id) || id <= 0 || !mesValido(competencia)) redirect("/contracheques");
  const { error } = await (await createClient()).rpc("admin_remover_contracheque_6a" as never, { p_id: id } as never);
  revalidatePath("/contracheques");
  redirect(`/contracheques?competencia=${competencia}&${error ? "erro=falhou" : "ok=removido"}`);
}

export async function decidirAtestado6b(formData: FormData) {
  await requireCapability("admin:manage");
  if (!oficialLiberado4f()) redirect("/dashboard");
  const id = Number(texto(formData, "id")), aceitar = texto(formData, "decisao") === "aceitar", motivo = texto(formData, "motivo").replace(/\s+/g, " ").slice(0, 300);
  if (!Number.isInteger(id) || id <= 0) redirect("/pedidos#atestados");
  if (!aceitar && (motivo.length < 5 || /[\u0000-\u001f]/.test(motivo))) redirect("/pedidos?erro=atestado-motivo#atestados");
  const { data, error } = await (await createClient()).rpc("admin_decidir_atestado_6b" as never, { p_id: id, p_aceitar: aceitar, p_motivo: aceitar ? null : motivo } as never);
  if (error) redirect(`/pedidos?erro=${error.message.includes("mes_fechado") ? "atestado-mes-fechado" : "atestado"}#atestados`);
  revalidatePath("/pedidos"); revalidatePath("/ponto-laboratorio/espelho"); revalidatePath("/dashboard");
  redirect(aceitar ? `/pedidos?ok=atestado-aceito&dias=${Number(data) || 0}#atestados` : "/pedidos?ok=atestado-recusado#atestados");
}
