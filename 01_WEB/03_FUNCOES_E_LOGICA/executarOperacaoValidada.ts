import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Capability } from "@metallo/core";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { createClient } from "@/05_ACESSO_A_DADOS/Supabase/server";

export type OperationState = { error?: string };
type Client = Awaited<ReturnType<typeof createClient>>;
const errors: Array<[string, string]> = [
  ["invalid_replacement", "Informe um patrimônio diferente e confira se a locação continua ativa."],
  ["shoe_size", "Selecione o tamanho da bota entre 38 e 46."],
  ["insufficient", "O estoque disponível não é suficiente. Atualize a página e confira o lote."],
  ["request_not_pending", "Esta solicitação já foi atendida. Atualize a página."],
  ["stock_batch", "O lote não corresponde ao item ou à variante solicitada."],
  ["variant", "Confira o tamanho ou a variante solicitada."],
  ["duplicate", "Já existe um registro ou solicitação com esses dados."],
  ["team_has", "A equipe ainda tem vínculos ou estoque. Transfira-os antes de desativar."],
  ["central", "O almoxarifado central não pode ser desativado."],
  ["forbidden", "Seu perfil não tem permissão para esta operação."],
  ["not_found", "O registro não está mais disponível. Atualize a página."],
];
export function operationMessage(message: string) {
  return errors.find(([code]) => message.includes(code))?.[1] ?? "Não foi possível concluir. Confira os dados e tente novamente.";
}

// Authorization is checked on the server for every submitted operation.
export async function executeValidated<S extends z.ZodType>(options: {
  schema: S; capability: Capability; formData: FormData;
  operation: (client: Client, data: z.output<S>) => PromiseLike<{ error: { message: string } | null }>;
  paths: string[]; destination: string | ((data: z.output<S>) => string);
}): Promise<OperationState> {
  await requireCapability(options.capability);
  const parsed = options.schema.safeParse(Object.fromEntries(options.formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os campos." };
  try {
    const result = await options.operation(await createClient(), parsed.data);
    if (result.error) return { error: operationMessage(result.error.message) };
  } catch {
    return { error: "Não foi possível confirmar a operação. Atualize a página antes de tentar novamente." };
  }
  for (const path of options.paths) revalidatePath(path, "layout");
  redirect(typeof options.destination === "function" ? options.destination(parsed.data) : options.destination);
}
