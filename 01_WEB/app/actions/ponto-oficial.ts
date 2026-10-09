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
  const cno = soDigitos(texto(formData, "cno")), inpi = soDigitos(texto(formData, "inpi")), responsavel = soDigitos(texto(formData, "responsavel"));
  const tipo = documento.length === 11 ? 2 : 1;
  const docOk = tipo === 1 ? cnpjValido(documento) : cpfValido(documento);
  const devOk = (!dev || (dev.length === 14 ? cnpjValido(dev) : cpfValido(dev))) && (!responsavel || cpfValido(responsavel));
  if (!docOk || !devOk || razao.length < 2 || razao.length > 150 || local.length < 2 || local.length > 100 || cno.length > 14 || inpi.length > 17
    || /[\u0000-\u001f]/.test(razao + local)) redirect(`${DESTINO}?erro=empresa-invalida`);
  const { error } = await (await createClient()).rpc("admin_set_employer_4i" as never, { p_tipo: tipo, p_documento: documento, p_cno: cno,
    p_razao: razao, p_local: local, p_inpi: inpi, p_dev: dev, p_responsavel: responsavel } as never);
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

// Marco 4G: jornada padrão da empresa. Campos "d<dia>_<n>" (dia 1 = segunda … 7 = domingo; n = 1..4), "hh:mm" ou vazio.
export async function salvarJornada4g(formData: FormData) {
  await requireCapability("admin:manage");
  if (!oficialLiberado4f()) redirect("/ponto-laboratorio");
  const dias: Record<string, string[]> = {};
  for (let d = 1; d <= 7; d++) {
    const horarios = [1, 2, 3, 4].map(n => texto(formData, `d${d}_${n}`)).filter(Boolean);
    const ok = horarios.length % 2 === 0 && horarios.every(h => /^([01]\d|2[0-3]):[0-5]\d$/.test(h)) && horarios.every((h, i) => i === 0 || h > horarios[i - 1]);
    if (!ok) redirect(`${DESTINO}?erro=jornada-invalida#jornada`);
    dias[String(d)] = horarios;
  }
  const { error } = await (await createClient()).rpc("admin_set_jornada_4g" as never, { p_dias: dias } as never);
  if (error) redirect(`${DESTINO}?erro=jornada-invalida#jornada`);
  revalidatePath(DESTINO); revalidatePath("/ponto-laboratorio/espelho");
  redirect(`${DESTINO}?ok=jornada#jornada`);
}

// Marco 4H: feriados (administrador) e ocorrências do dia por funcionário (atestado, férias, folga, faltas).
const DATA = /^20\d{2}-\d{2}-\d{2}$/;
export async function salvarFeriado4h(formData: FormData) {
  await requireCapability("admin:manage");
  if (!oficialLiberado4f()) redirect("/ponto-laboratorio");
  const data = texto(formData, "data"), nome = texto(formData, "nome").replace(/\s+/g, " "), tipo = texto(formData, "tipo");
  if (!DATA.test(data) || nome.length < 2 || nome.length > 80 || !["nacional", "estadual", "municipal", "empresa"].includes(tipo)) redirect(`${DESTINO}?erro=feriado-invalido#feriados`);
  const { error } = await (await createClient()).rpc("admin_set_feriado_4h" as never, { p_data: data, p_nome: nome, p_tipo: tipo } as never);
  if (error) redirect(`${DESTINO}?erro=feriado-invalido#feriados`);
  revalidatePath(DESTINO); revalidatePath("/ponto-laboratorio/espelho");
  redirect(`${DESTINO}?ok=feriado#feriados`);
}
export async function removerFeriado4h(formData: FormData) {
  await requireCapability("admin:manage");
  if (!oficialLiberado4f()) redirect("/ponto-laboratorio");
  const data = texto(formData, "data");
  if (!DATA.test(data)) redirect(`${DESTINO}?erro=feriado-invalido#feriados`);
  const { error } = await (await createClient()).rpc("admin_remove_feriado_4h" as never, { p_data: data } as never);
  if (error) redirect(`${DESTINO}?erro=falhou#feriados`);
  revalidatePath(DESTINO); revalidatePath("/ponto-laboratorio/espelho");
  redirect(`${DESTINO}?ok=feriado-removido#feriados`);
}

const TIPOS = ["atestado", "ferias", "folga", "falta_justificada", "falta", "folga_feriado"];
const voltarEspelho = (mes: string, funcionario: string, extra: string) => `/ponto-laboratorio/espelho?mes=${mes}&funcionario=${funcionario}&${extra}`;
export async function salvarOcorrencia4h(formData: FormData) {
  await requireCapability("admin:manage");
  if (!oficialLiberado4f()) redirect("/ponto-laboratorio");
  const id = texto(formData, "employeeId"), data = texto(formData, "data"), tipo = texto(formData, "tipo"), obs = texto(formData, "observacao").slice(0, 200);
  const mes = data.slice(0, 7);
  if (!UUID.test(id) || !DATA.test(data) || !TIPOS.includes(tipo) || /[\u0000-\u001f]/.test(obs)) redirect(voltarEspelho(mes, id, "erro=ocorrencia"));
  const { error } = await (await createClient()).rpc("admin_set_ocorrencia_4h" as never, { p_employee_id: id, p_data: data, p_tipo: tipo, p_observacao: obs } as never);
  if (error) redirect(voltarEspelho(mes, id, "erro=ocorrencia"));
  revalidatePath("/ponto-laboratorio/espelho");
  redirect(voltarEspelho(mes, id, "ok=ocorrencia"));
}
export async function cancelarOcorrencia4h(formData: FormData) {
  await requireCapability("admin:manage");
  if (!oficialLiberado4f()) redirect("/ponto-laboratorio");
  const ocorrencia = Number(texto(formData, "ocorrenciaId")), id = texto(formData, "employeeId"), mes = texto(formData, "mes");
  if (!Number.isInteger(ocorrencia) || ocorrencia <= 0 || !UUID.test(id) || !/^20\d{2}-\d{2}$/.test(mes)) redirect("/ponto-laboratorio/espelho");
  const { error } = await (await createClient()).rpc("admin_cancelar_ocorrencia_4h" as never, { p_id: ocorrencia } as never);
  revalidatePath("/ponto-laboratorio/espelho");
  redirect(voltarEspelho(mes, id, error ? "erro=ocorrencia" : "ok=ocorrencia-cancelada"));
}
