import { NextRequest, NextResponse } from "next/server";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { createClient } from "@/05_ACESSO_A_DADOS/Supabase/server";
import { getSupabaseEnv } from "@/09_CONFIGURACOES/ambienteSupabase";
import { TESTE_ONLINE_GESTAO_ORIGIN, TESTE_ONLINE_SUPABASE_URL } from "@/09_CONFIGURACOES/ambiente-teste-online";

const limite = 6 * 1024 * 1024;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (request.headers.get("origin") !== TESTE_ONLINE_GESTAO_ORIGIN || getSupabaseEnv().url !== TESTE_ONLINE_SUPABASE_URL || !/^[1-9]\d*$/.test(id))
    return new NextResponse(null, { status: 403 });
  await requireCapability("equipment:write");
  const voltar = (resultado: string) => NextResponse.redirect(new URL(`/frota/${id}?aba=manutencao&comprovante=${resultado}`, TESTE_ONLINE_GESTAO_ORIGIN), 303);
  if (Number(request.headers.get("content-length")) > limite + 65536) return voltar("tamanho");
  try {
    const form = await request.formData();
    const arquivo = form.get("arquivo");
    const ordem = form.get("ordem_id");
    if (!(arquivo instanceof File) || !arquivo.size || typeof ordem !== "string" || !/^[1-9]\d*$/.test(ordem)) return voltar("invalido");
    if (arquivo.size > limite) return voltar("tamanho");
    const sessao = await (await createClient()).auth.getSession();
    const token = sessao.data.session?.access_token;
    if (!token || sessao.error) return voltar("falha");
    const corpo = new FormData();
    corpo.set("acao", "comprovar_reparo");
    corpo.set("veiculo_id", id);
    corpo.set("ordem_id", ordem);
    corpo.set("arquivo", arquivo, "comprovante");
    const resposta = await fetch(`${TESTE_ONLINE_SUPABASE_URL}/functions/v1/fotos-frota-10b`, {
      method: "POST", headers: { Origin: TESTE_ONLINE_GESTAO_ORIGIN, Authorization: `Bearer ${token}` },
      body: corpo, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(45000)
    });
    const dados = await resposta.json();
    return voltar(resposta.ok && dados.ok === true ? "salvo" : dados.error === "tipo_arquivo" ? "invalido" : "falha");
  } catch { return voltar("falha"); }
}
