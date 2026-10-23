import { NextRequest, NextResponse } from "next/server";
import { can } from "@metallo/core";
import { getSessionProfile } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { linkFoto10b } from "@/05_ACESSO_A_DADOS/Arquivos/fotos-frota-10b";
import { getSupabaseEnv } from "@/09_CONFIGURACOES/ambienteSupabase";
import { recursosNovosLiberados } from "@/09_CONFIGURACOES/ambiente-teste-online";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Marco 10B: abre a foto do defeito (link do Storage que vale 2 minutos). Quem opera equipamentos; o banco confere de novo.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getSessionProfile();
  const { id } = await params;
  if (!profile?.active || !can(profile, "equipment:write") || !recursosNovosLiberados(getSupabaseEnv().url) || !UUID.test(id)) return new NextResponse(null, { status: 404 });
  try {
    return NextResponse.redirect(await linkFoto10b(id), { status: 303, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch {
    return new NextResponse("Foto indisponível. Volte e tente de novo.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }
}
