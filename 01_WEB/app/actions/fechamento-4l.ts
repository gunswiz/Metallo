"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { mesAtual, mesValido } from "@/03_FUNCOES_E_LOGICA/Ponto/espelho-4e";
import { fotoDias4l, resumoHoras4l } from "@/03_FUNCOES_E_LOGICA/Ponto/fechamento-4l";
import { createClient } from "@/05_ACESSO_A_DADOS/Supabase/server";
import { oficialLiberado4f } from "@/05_ACESSO_A_DADOS/Ponto/oficial-4f";
import { carregarMes4l, lerFechamentos4l } from "@/05_ACESSO_A_DADOS/Ponto/mes-4l";

// Marco 4L: fechar e reabrir o mês do ponto. A foto é montada AQUI no servidor (não vem do navegador).
const texto = (f: FormData, k: string) => { const v = f.get(k); return typeof v === "string" ? v.trim() : ""; };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const destino = (mes: string, extra: string) => `/ponto-laboratorio/fechamento?mes=${mes}&${extra}`;
function codigoErro(message: string) {
  return message.includes("mes_ja_fechado") ? "ja-fechado" : message.includes("mes_nao_terminou") ? "nao-terminou"
    : message.includes("resumo_desatualizado") ? "desatualizado" : "falhou";
}

export async function fecharMes4l(formData: FormData) {
  await requireCapability("admin:manage");
  if (!oficialLiberado4f()) redirect("/ponto-laboratorio");
  const mes = texto(formData, "mes"), id = texto(formData, "employeeId"), mesmoAssim = texto(formData, "mesmoAssim") === "1";
  if (!mesValido(mes) || !UUID.test(id)) redirect("/ponto-laboratorio/fechamento");
  if (mes >= mesAtual()) redirect(destino(mes, "erro=nao-terminou"));
  const { pessoas, erro } = await carregarMes4l(mes);
  const pessoa = pessoas.find(p => p.employee_id === id);
  if (erro || !pessoa) redirect(destino(mes, "erro=leitura"));
  const resumo = resumoHoras4l(pessoa.espelho);
  if (resumo.conferir > 0 && !mesmoAssim) redirect(destino(mes, "erro=conferir"));
  const { error } = await (await createClient()).rpc("admin_fechar_mes_4l" as never,
    { p_employee_id: id, p_mes: mes, p_resumo: resumo, p_dias: fotoDias4l(pessoa.espelho) } as never);
  if (error) redirect(destino(mes, `erro=${codigoErro(error.message)}`));
  revalidatePath("/ponto-laboratorio/fechamento");
  redirect(destino(mes, "ok=fechado"));
}

// Fecha de uma vez todo mundo que NÃO tem dia para conferir e ainda está aberto.
export async function fecharTodos4l(formData: FormData) {
  await requireCapability("admin:manage");
  if (!oficialLiberado4f()) redirect("/ponto-laboratorio");
  const mes = texto(formData, "mes");
  if (!mesValido(mes)) redirect("/ponto-laboratorio/fechamento");
  if (mes >= mesAtual()) redirect(destino(mes, "erro=nao-terminou"));
  const [{ pessoas, erro }, fechados] = await Promise.all([carregarMes4l(mes), lerFechamentos4l(mes).catch(() => null)]);
  if (erro || !fechados) redirect(destino(mes, "erro=leitura"));
  const jaFechados = new Set(fechados.map(f => f.employee_id));
  const client = await createClient();
  let feitos = 0, pulados = 0;
  for (const p of pessoas) {
    if (jaFechados.has(p.employee_id)) continue;
    const resumo = resumoHoras4l(p.espelho);
    if (resumo.conferir > 0) { pulados++; continue; }
    const { error } = await client.rpc("admin_fechar_mes_4l" as never, { p_employee_id: p.employee_id, p_mes: mes, p_resumo: resumo, p_dias: fotoDias4l(p.espelho) } as never);
    if (error) pulados++; else feitos++;
  }
  revalidatePath("/ponto-laboratorio/fechamento");
  redirect(destino(mes, `ok=todos&feitos=${feitos}&pulados=${pulados}`));
}

export async function reabrirMes4l(formData: FormData) {
  await requireCapability("admin:manage");
  if (!oficialLiberado4f()) redirect("/ponto-laboratorio");
  const mes = texto(formData, "mes"), id = Number(texto(formData, "fechamentoId")), motivo = texto(formData, "motivo").replace(/\s+/g, " ").slice(0, 300);
  if (!mesValido(mes) || !Number.isInteger(id) || id <= 0) redirect("/ponto-laboratorio/fechamento");
  if (motivo.length < 5 || /[\u0000-\u001f]/.test(motivo)) redirect(destino(mes, "erro=motivo"));
  const { error } = await (await createClient()).rpc("admin_reabrir_mes_4l" as never, { p_id: id, p_motivo: motivo } as never);
  if (error) redirect(destino(mes, "erro=falhou"));
  revalidatePath("/ponto-laboratorio/fechamento"); revalidatePath("/ponto-laboratorio/espelho");
  redirect(destino(mes, "ok=reaberto"));
}
