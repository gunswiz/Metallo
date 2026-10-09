import { NextRequest, NextResponse } from "next/server";
import { can } from "@metallo/core";
import { getSessionProfile } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { latin1 } from "@/03_FUNCOES_E_LOGICA/Ponto/oficial-4f";
import { gerarAfd4f, oficialLiberado4f } from "@/05_ACESSO_A_DADOS/Ponto/oficial-4f";

export const dynamic = "force-dynamic";
const DATA = /^20\d{2}-\d{2}-\d{2}$/;

// Marco 4F: baixa o AFD (prévia, leiaute v004) do período. Só administrador; a Edge Function confere admin e sessão de novo.
export async function GET(request: NextRequest) {
  const voltar = (erro: string) => NextResponse.redirect(new URL(`/ponto-laboratorio/oficial?erro=${erro}#afd`, request.url), 303);
  const profile = await getSessionProfile();
  if (!profile?.active || !can(profile, "admin:manage") || !oficialLiberado4f()) return new NextResponse(null, { status: 404 });
  const de = request.nextUrl.searchParams.get("de") ?? "", ate = request.nextUrl.searchParams.get("ate") ?? "";
  if (!DATA.test(de) || !DATA.test(ate) || ate < de) return voltar("afd-periodo");
  try {
    const afd = await gerarAfd4f(de, ate);
    return new NextResponse(latin1(afd.content), { headers: { "Content-Type": "text/plain; charset=iso-8859-1", "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${afd.filename}"`, "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return voltar(code === "EMPREGADOR_NAO_CADASTRADO" ? "afd-empresa" : code === "PERIODO_INVALIDO" ? "afd-periodo" : "afd-falhou");
  }
}
