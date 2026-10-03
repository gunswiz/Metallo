"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { communicationInput3h, communicationExpiryIso3h, type CommunicationSaveState3h } from "@/03_FUNCOES_E_LOGICA/Comunicados/contrato-3h";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { createClient } from "@/05_ACESSO_A_DADOS/Supabase/server";
import { requireCommunicationLab3h } from "@/05_ACESSO_A_DADOS/Supabase/comunicados-3h";

const value = (form: FormData, key: string) => String(form.get(key) ?? "");
const nullable = (form: FormData, key: string) => value(form, key) || null;

export async function saveCommunication3h(_previous: CommunicationSaveState3h, form: FormData): Promise<CommunicationSaveState3h> {
  await requireCapability("admin:manage");
  requireCommunicationLab3h();
  let expiresAt: string | null;
  try { expiresAt = communicationExpiryIso3h(nullable(form, "expiresAt")); }
  catch { return { error: "Confira a expiração no horário de Fortaleza." }; }
  const parsed = communicationInput3h.safeParse({
    id: nullable(form, "id"), title: value(form, "title"), message: value(form, "message"),
    audience: value(form, "audience"), teamId: nullable(form, "teamId"), workId: nullable(form, "workId"),
    pinned: value(form, "pinned") === "on",
    expiresAt,
    idempotencyKey: value(form, "idempotencyKey"),
    expectedVersion: nullable(form, "expectedVersion") ? Number(value(form, "expectedVersion")) : null,
  });
  if (!parsed.success) return { error: "Confira os campos e o público do comunicado." };
  const data = parsed.data;
  const client = await createClient();
  // Erros preservam campos e chave no formulário; redirect de sucesso fica fora do catch.
  try {
  const saved = await client.rpc("save_communication_3h" as never, {
    p_id: data.id, p_title: data.title, p_message: data.message, p_audience: data.audience,
    p_team_id: data.teamId, p_work_id: data.workId, p_pinned: data.pinned,
    p_expires_at: data.expiresAt, p_idempotency_key: data.idempotencyKey,
    p_expected_version: data.expectedVersion,
  } as never);
  if (saved.error) return { error: "Não foi possível salvar. Tente novamente sem alterar os campos; se a versão mudou, recarregue a lista." };
  const savedId = saved.data as unknown;
  if (typeof savedId !== "string") return { error: "Resposta indisponível. Tente novamente sem alterar os campos." };
  if (value(form, "intent") === "publish") {
    const published = await client.rpc("publish_communication_3h" as never,
      { p_id: savedId, p_expected_version: data.id ? (data.expectedVersion ?? 0) + 1 : 1 } as never);
    if (published.error) return { error: "O salvamento foi confirmado, mas a publicação não pôde ser confirmada. Tente novamente sem alterar os campos ou confira o comunicado na lista." };
  }
  } catch { return { error: "Conexão interrompida. Tente novamente sem alterar os campos ou confira a lista antes de iniciar outro comunicado." }; }
  revalidatePath("/comunicados");
  redirect("/comunicados?ok=1");
}

export async function publishCommunication3h(form: FormData) {
  await requireCapability("admin:manage");
  requireCommunicationLab3h();
  const client = await createClient();
  const id = value(form, "id"); const version = Number(value(form, "version"));
  if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isSafeInteger(version)) redirect("/comunicados?error=dados-invalidos");
  const result = await client.rpc("publish_communication_3h" as never,
    { p_id: id, p_expected_version: version } as never);
  if (result.error) redirect("/comunicados?error=publicacao");
  revalidatePath("/comunicados"); redirect("/comunicados?ok=1");
}

export async function archiveCommunication3h(form: FormData) {
  await requireCapability("admin:manage");
  requireCommunicationLab3h();
  const client = await createClient();
  const id = value(form, "id"); const version = Number(value(form, "version"));
  if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isSafeInteger(version)) redirect("/comunicados?error=dados-invalidos");
  const result = await client.rpc("archive_communication_3h" as never,
    { p_id: id, p_expected_version: version } as never);
  if (result.error) redirect("/comunicados?error=operacao");
  revalidatePath("/comunicados"); redirect("/comunicados?ok=1");
}
