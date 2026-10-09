"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { createClient } from "@/05_ACESSO_A_DADOS/Supabase/server";

// Marco 3T: Gestão marca o pedido de material como atendido ou recusado (recusar exige o motivo, que o funcionário vê).
export async function decidirPedidoMaterial3t(formData: FormData) {
  await requireCapability("epi:write");
  const id = Number(formData.get("pedidoId")), status = String(formData.get("status") ?? ""), resposta = String(formData.get("resposta") ?? "").trim().slice(0, 200);
  if (!Number.isInteger(id) || id <= 0 || !["atendido", "recusado"].includes(status) || (status === "recusado" && !resposta) || /[\u0000-\u0008\u000b-\u001f]/.test(resposta))
    redirect("/pedidos?erro=material#pedidos-material");
  const { error } = await (await createClient()).rpc("decide_pedido_material_3t" as never, { p_id: id, p_status: status, p_resposta: resposta } as never);
  revalidatePath("/pedidos"); revalidatePath("/dashboard");
  redirect(error ? "/pedidos?erro=material#pedidos-material" : "/pedidos?ok=1#pedidos-material");
}
