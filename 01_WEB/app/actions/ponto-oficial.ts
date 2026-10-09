"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { cnpjValido, cpfValido, soDigitos } from "@/03_FUNCOES_E_LOGICA/Ponto/oficial-4f";
import { createClient } from "@/05_ACESSO_A_DADOS/Supabase/server";
import { oficialLiberado4f } from "@/05_ACESSO_A_DADOS/Ponto/oficial-4f";

const DESTINO = "/ponto-laboratorio/oficial";
const texto = (f: FormData, k: string) => { const v = f.get(k); return typeof v === "string" ? v.trim() : ""; };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Marco 4F: dados da empresa para o AFD.
export async function salvarEmpresa4f(formData: FormData) {
  await requireCapability("admin:manage");
  if (!oficialLiberado4f()) redirect("/ponto-laboratorio");
  const documento = soDigitos(texto(formData, "documento")), dev = soDigitos(texto(formData, "desenvolvedor"));
  const razao = texto(formData, "razao").replace(/\s+/g, " "), local = texto(formData, "local").replace(/\s+/g, " ");
  const cno = soDigitos(texto(formData, "cno")), inpi = soDigitos(texto(formData, "inpi"));
  const tipo = documento.length === 11 ? 2 : 1;
  const docOk = tipo === 1 ? cnpjValido(documento) : cpfValido(documento);
  const devOk = !dev || (dev.length === 14 ? cnpjValido(dev) : cpfValido(dev));
  if (!docOk || !devOk || razao.length < 2 || razao.length > 150 || local.length < 2 || local.length > 100 || cno.length > 14 || inpi.length > 17
    || /[\u0000-\u001f]/.test(razao + local)) redirect(`${DESTINO}?erro=empresa-invalida`);
  const { error } = await (await createClient()).rpc("admin_set_employer_4f" as never, { p_tipo: tipo, p_documento: documento, p_cno: cno,
    p_razao: razao, p_local: local, p_inpi: inpi, p_dev: dev } as never);
  if (error) redirect(`${DESTINO}?erro=falhou`);
  revalidatePath(DESTINO);
  redirect(`${DESTINO}?ok=empresa`);
}

// Marco 4F: CPF do funcionário (vazio = remover). O CPF completo nunca volta para a tela.
export async function salvarCpf4f(formData: FormData) {
  await requireCapability("admin:manage");
  if (!oficialLiberado4f()) redirect("/ponto-laboratorio");
  const id = texto(formData, "employeeId"), cpf = soDigitos(texto(formData, "cpf"));
  if (!UUID.test(id) || (cpf && !cpfValido(cpf))) redirect(`${DESTINO}?erro=cpf-invalido#cpf`);
  const { error } = await (await createClient()).rpc("admin_set_employee_cpf_4f" as never, { p_employee_id: id, p_cpf: cpf } as never);
  if (error) redirect(`${DESTINO}?erro=${error.message.includes("cpf_em_uso") ? "cpf-em-uso" : error.message.includes("cpf_invalido") ? "cpf-invalido" : "falhou"}#cpf`);
  revalidatePath(DESTINO);
  redirect(`${DESTINO}?ok=cpf#cpf`);
}
