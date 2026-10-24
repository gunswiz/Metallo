import { NextRequest, NextResponse } from "next/server";
import { can } from "@metallo/core";
import { getSessionProfile } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { csvRelatorio10d, MES_RELATORIO_10D } from "@/03_FUNCOES_E_LOGICA/Frota/relatorio-10d";
import { lerRelatorioFrota10d } from "@/05_ACESSO_A_DADOS/Supabase/frota-10a";
import { getSupabaseEnv } from "@/09_CONFIGURACOES/ambienteSupabase";
import { recursosNovosLiberados } from "@/09_CONFIGURACOES/ambiente-teste-online";

export const dynamic = "force-dynamic";

// Marco 10D: relatório do mês da frota (planilha). Quem opera equipamentos; o banco confere de novo.
export async function GET(request: NextRequest) {
  const profile = await getSessionProfile();
  const mes = request.nextUrl.searchParams.get("mes") ?? "";
  if (!profile?.active || !can(profile, "equipment:write") || !recursosNovosLiberados(getSupabaseEnv().url) || !MES_RELATORIO_10D.test(mes)) return new NextResponse(null, { status: 404 });
  try {
    return new NextResponse(csvRelatorio10d(await lerRelatorioFrota10d(mes)), { headers: {
      "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="frota-${mes}.csv"`, "Cache-Control": "private, no-store" } });
  } catch {
    return new NextResponse("Relatório indisponível. Volte e tente de novo.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" } });
  }
}
