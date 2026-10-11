import { NextRequest, NextResponse } from "next/server";
import { can } from "@metallo/core";
import { getSessionProfile } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { oficialLiberado4f } from "@/05_ACESSO_A_DADOS/Ponto/oficial-4f";
import { linkArquivo6 } from "@/05_ACESSO_A_DADOS/Arquivos/arquivos-6";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Marcos 6A/6B: abre um contracheque ou atestado (link do Storage que vale 2 minutos). Só administrador; o banco confere de novo.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getSessionProfile();
  const { id } = await params;
  if (!profile?.active || !can(profile, "admin:manage") || !oficialLiberado4f() || !UUID.test(id)) return new NextResponse(null, { status: 404 });
  try {
    return NextResponse.redirect(await linkArquivo6(id), { status: 303, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch {
    return new NextResponse("Arquivo indisponível. Volte e tente de novo.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }
}
