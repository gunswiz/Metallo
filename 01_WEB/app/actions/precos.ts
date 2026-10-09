"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { lerPrecoBR } from "@/03_FUNCOES_E_LOGICA/Precos/precos-3q";
import { createClient } from "@/05_ACESSO_A_DADOS/Supabase/server";
import { precosLiberados3q } from "@/05_ACESSO_A_DADOS/Supabase/precos-3q";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Marco 3Q: salva só os preços que mudaram. Campo "preco:<id>" (novo) e "antes:<id>" (como estava na tela).
export async function salvarPrecos(formData: FormData) {
  await requireCapability("admin:manage");
  if (!precosLiberados3q()) redirect("/materiais");
  const mudancas: Array<{ item_id: string; unit_price: number | null }> = [];
  for (const [chave, valor] of formData.entries()) {
    if (!chave.startsWith("preco:") || typeof valor !== "string") continue;
    const id = chave.slice(6);
    if (!UUID.test(id)) redirect("/materiais/precos?erro=invalido");
    const novo = lerPrecoBR(valor);
    const antesTexto = formData.get(`antes:${id}`);
    const antes = lerPrecoBR(typeof antesTexto === "string" ? antesTexto : "");
    if (novo === undefined) redirect("/materiais/precos?erro=invalido");
    if (novo !== antes) mudancas.push({ item_id: id, unit_price: novo as number | null });
  }
  if (mudancas.length === 0) redirect("/materiais/precos?erro=nada");
  if (mudancas.length > 500) redirect("/materiais/precos?erro=invalido");
  const { data, error } = await (await createClient()).rpc("admin_set_item_prices_3q" as never, { p_prices: mudancas } as never);
  if (error) redirect("/materiais/precos?erro=falhou");
  revalidatePath("/materiais/precos"); revalidatePath("/consumo");
  redirect(`/materiais/precos?ok=${Number(data) || mudancas.length}`);
}
