"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { createClient } from "@/05_ACESSO_A_DADOS/Supabase/server";

// Marco 5D: validade do Certificado de Aprovação (CA) do EPI. Em branco = não informada.
export async function salvarValidadeCa5d(formData: FormData) {
  await requireCapability("epi:write");
  const itemId = String(formData.get("itemId") ?? ""), validade = String(formData.get("validade") ?? "").trim();
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(itemId) || (validade && !/^20\d{2}-\d{2}-\d{2}$/.test(validade))) redirect(`/epis/${uuid.test(itemId) ? itemId : ""}?error=ca`);
  const { error } = await (await createClient()).rpc("admin_set_ca_validade_5d" as never, { p_item_id: itemId, p_validade: validade || null } as never);
  revalidatePath(`/epis/${itemId}`); revalidatePath("/dashboard");
  redirect(error ? `/epis/${itemId}?error=ca` : `/epis/${itemId}?updated=ca`);
}
