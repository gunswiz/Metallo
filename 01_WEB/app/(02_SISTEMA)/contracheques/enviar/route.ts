import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { can } from "@metallo/core";
import { getSessionProfile } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { mesAtual, mesValido } from "@/03_FUNCOES_E_LOGICA/Ponto/espelho-4e";
import { oficialLiberado4f } from "@/05_ACESSO_A_DADOS/Ponto/oficial-4f";
import { enviarContracheque6a, TIPOS_FOLHA } from "@/05_ACESSO_A_DADOS/Arquivos/arquivos-6";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX = 6 * 1024 * 1024;

// Marco 6A: envio do PDF do contracheque (rota própria porque o arquivo passa do limite das ações do formulário).
// Só a própria Gestão (mesma origem) e só administrador; a Edge Function e o banco conferem tudo de novo.
export async function POST(request: NextRequest) {
  const profile = await getSessionProfile();
  if (!profile?.active || !can(profile, "admin:manage") || !oficialLiberado4f()) return new NextResponse(null, { status: 404 });
  if (request.headers.get("origin") !== request.nextUrl.origin) return new NextResponse(null, { status: 403 });
  const form = await request.formData().catch(() => null);
  const texto = (k: string) => { const v = form?.get(k); return typeof v === "string" ? v.trim() : ""; };
  const competencia = mesValido(texto("competencia")) ? texto("competencia") : mesAtual();
  const voltar = (extra: string) => NextResponse.redirect(new URL(`/contracheques?competencia=${competencia}&${extra}`, request.url), 303);
  const arquivo = form?.get("arquivo"), employee = texto("employeeId"), tipo = texto("tipoFolha");
  if (!(arquivo instanceof File) || arquivo.size < 1) return voltar("erro=sem-arquivo");
  if (arquivo.size > MAX) return voltar("erro=grande");
  if (!UUID.test(employee) || !(tipo in TIPOS_FOLHA)) return voltar("erro=falhou");
  try {
    await enviarContracheque6a(arquivo, employee, competencia, tipo);
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    return voltar(`erro=${code === "tipo_arquivo" ? "nao-pdf" : code === "arquivo_grande" ? "grande" : code === "competencia_invalida" ? "competencia" : "falhou"}`);
  }
  revalidatePath("/contracheques");
  return voltar("ok=enviado");
}
