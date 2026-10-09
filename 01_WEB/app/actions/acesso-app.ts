"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { createClient } from "@/05_ACESSO_A_DADOS/Supabase/server";

// Marco 3O: as ações chamam a função segura "acesso-funcionario" com o login do próprio administrador.
const id = z.uuid();
const pedido = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("criar"), employee_id: id, usuario: z.string().trim().toLowerCase().max(30), senha: z.string().max(72) }),
  z.object({ acao: z.literal("nova_senha"), employee_id: id, senha: z.string().max(72) }),
  z.object({ acao: z.literal("bloquear"), employee_id: id, motivo: z.enum(["employment_ended", "wrong_association", "account_replaced", "other"]) }),
]);

export async function alterarAcessoApp(formData: FormData) {
  await requireCapability("admin:manage");
  const campo = (name: string) => { const value = formData.get(name); return typeof value === "string" ? value : undefined; };
  const parsed = pedido.safeParse({ acao: campo("acao"), employee_id: campo("employee_id"), usuario: campo("usuario"),
    senha: campo("senha"), motivo: campo("motivo") });
  if (!parsed.success) redirect("/acesso-app?erro=falha");
  const supabase = await createClient();
  const result = await supabase.functions.invoke("acesso-funcionario", { body: parsed.data });
  let codigo = "falha";
  if (!result.error && result.data?.ok === true) codigo = "";
  else {
    const context = (result.error as { context?: Response } | null)?.context;
    const body = context ? await context.json().catch(() => null) : result.data;
    if (typeof body?.error === "string") codigo = body.error;
  }
  revalidatePath("/acesso-app");
  const alvo = encodeURIComponent(parsed.data!.employee_id);
  if (codigo) redirect(`/acesso-app?erro=${encodeURIComponent(codigo)}&f=${alvo}`);
  redirect(`/acesso-app?ok=${parsed.data!.acao}&f=${alvo}`);
}
