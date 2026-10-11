"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { createClient } from "@/05_ACESSO_A_DADOS/Supabase/server";

// Marco 3T: Gestão marca o pedido de material como atendido ou recusado (recusar exige o motivo, que o funcionário vê).
// Marco 5B: ao atender, pode já dar baixa no estoque da obra (lança como consumo da equipe do funcionário).
export async function decidirPedidoMaterial3t(formData: FormData) {
  await requireCapability("epi:write");
  const id = Number(formData.get("pedidoId")), status = String(formData.get("status") ?? ""), resposta = String(formData.get("resposta") ?? "").trim().slice(0, 200);
  const baixar = formData.get("baixar") === "1";
  if (!Number.isInteger(id) || id <= 0 || !["atendido", "recusado"].includes(status) || (status === "recusado" && !resposta) || /[\u0000-\u0008\u000b-\u001f]/.test(resposta))
    redirect("/pedidos?erro=material#pedidos-material");
  const { error } = await (await createClient()).rpc("decide_pedido_material_5b" as never,
    { p_id: id, p_status: status, p_resposta: resposta, p_baixar: status === "atendido" && baixar } as never);
  revalidatePath("/pedidos"); revalidatePath("/dashboard"); revalidatePath("/materiais");
  if (error) {
    const m = error.message ?? "";
    const codigo = /insufficient_stock/.test(m) ? "material-sem-saldo" : /funcionario_sem_equipe/.test(m) ? "material-sem-equipe"
      : /forbidden_team|forbidden_role/.test(m) ? "material-sem-permissao" : /quantidade_fracionada/.test(m) ? "material-fracao" : "material";
    redirect(`/pedidos?erro=${codigo}#pedidos-material`);
  }
  redirect(status === "atendido" && baixar ? "/pedidos?ok=baixa#pedidos-material" : "/pedidos?ok=1#pedidos-material");
}
