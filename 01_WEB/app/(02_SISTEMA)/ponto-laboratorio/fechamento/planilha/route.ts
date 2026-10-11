import { NextRequest, NextResponse } from "next/server";
import { can } from "@metallo/core";
import { getSessionProfile } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { mesAtual, mesValido } from "@/03_FUNCOES_E_LOGICA/Ponto/espelho-4e";
import { planilha4l, resumoHoras4l, situacaoFechamento4l } from "@/03_FUNCOES_E_LOGICA/Ponto/fechamento-4l";
import { oficialLiberado4f } from "@/05_ACESSO_A_DADOS/Ponto/oficial-4f";
import { carregarMes4l, lerFechamentos4l, lerPercentuais4l } from "@/05_ACESSO_A_DADOS/Ponto/mes-4l";

export const dynamic = "force-dynamic";

// Marco 4L: planilha (CSV) do mês para o DP/contador. Só administrador.
export async function GET(request: NextRequest) {
  const profile = await getSessionProfile();
  if (!profile?.active || !can(profile, "admin:manage") || !oficialLiberado4f()) return new NextResponse(null, { status: 404 });
  const mes = request.nextUrl.searchParams.get("mes") ?? "";
  if (!mesValido(mes) || mes > mesAtual()) return NextResponse.redirect(new URL("/ponto-laboratorio/fechamento?erro=falhou", request.url), 303);
  const [{ pessoas, erro }, fechamentos, pct] = await Promise.all([carregarMes4l(mes), lerFechamentos4l(mes).catch(() => null), lerPercentuais4l()]);
  if (erro || !fechamentos) return NextResponse.redirect(new URL(`/ponto-laboratorio/fechamento?mes=${mes}&erro=leitura`, request.url), 303);
  const porPessoa = new Map(fechamentos.map(f => [f.employee_id, f]));
  const csv = planilha4l(mes, pessoas.map(p => ({ nome: p.nome, matricula: p.matricula, resumo: resumoHoras4l(p.espelho), situacao: situacaoFechamento4l(porPessoa.get(p.employee_id)) })), pct);
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "private, no-store",
    "Content-Disposition": `attachment; filename="horas-${mes}.csv"`, "X-Content-Type-Options": "nosniff" } });
}
