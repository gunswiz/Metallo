// Ambiente de TESTE ONLINE do Metallo (projeto Supabase "metallo-teste", só dados fictícios).
// Os endereços são fixos no código: nenhuma configuração consegue apontar o Colaborador
// ou os recursos novos para o projeto de produção (Almoxarifado Online).
export const LAB_SUPABASE_URL = "http://127.0.0.1:54321";
export const TESTE_ONLINE_SUPABASE_URL = "https://cvimwiqokkujfhwynhmt.supabase.co";
export const TESTE_ONLINE_COLABORADOR_ORIGIN = "https://metallo-teste-colaborador.metallo-gunswiz.workers.dev";
export const TESTE_ONLINE_COLABORADOR_HOST = new URL(TESTE_ONLINE_COLABORADOR_ORIGIN).host;
export const TESTE_ONLINE_GESTAO_ORIGIN = "https://metallo-teste-gestao.metallo-gunswiz.workers.dev";
/** Marco 4D: servidor do Meu Ponto no teste online (Edge Function sobre o schema "ponto"). */
export const TESTE_ONLINE_PONTO_4D = `${TESTE_ONLINE_SUPABASE_URL}/functions/v1/ponto-4d`;
/** Biometria do celular (3F) no teste online: Edge Function com o RP do Colaborador de teste. */
export const TESTE_ONLINE_ASSINATURA_3F = `${TESTE_ONLINE_SUPABASE_URL}/functions/v1/assinatura-epi-3f`;

/** Recursos ainda não liberados na produção (EPI 3D–3I, comunicados, itens pessoais). */
export function recursosNovosLiberados(supabaseUrl: string | undefined) {
  return supabaseUrl === LAB_SUPABASE_URL || supabaseUrl === TESTE_ONLINE_SUPABASE_URL;
}

export function ehTesteOnline(supabaseUrl: string | undefined) {
  return supabaseUrl === TESTE_ONLINE_SUPABASE_URL;
}

/** Redesign da proposta: apresentação somente no teste e nas prévias locais explícitas. */
export function redesignTesteLiberado(env: Record<string, string | undefined>) {
  return ehTesteOnline(env.NEXT_PUBLIC_SUPABASE_URL)
    || env.METALLO_COLABORADOR_TESTE_ONLINE === "1"
    || (env.METALLO_LOCAL_PREVIEW === "1" && (
      env.NEXT_PUBLIC_SUPABASE_URL === LAB_SUPABASE_URL
      || env.METALLO_COLABORADOR_VISUAL_PREVIEW === "1"
    ));
}

export function destinoLoginTeste(area: "gestao" | "colaborador", local: boolean) {
  if (local) return area === "gestao" ? "http://127.0.0.1:3102/login" : "http://127.0.0.1:3101/colaborador/login";
  return area === "gestao" ? `${TESTE_ONLINE_GESTAO_ORIGIN}/login` : `${TESTE_ONLINE_COLABORADOR_ORIGIN}/colaborador/login`;
}

/** Teste online: login rápido digitando só o usuário (ex.: "joao" vira joao@teste.metallo). */
export const TESTE_ONLINE_DOMINIO_LOGIN = "teste.metallo";
export function loginDeTeste(valor: string) {
  const v = valor.trim().toLowerCase();
  return v.includes("@") ? v : `${v}@${TESTE_ONLINE_DOMINIO_LOGIN}`;
}

/** Marco 3P: chave PÚBLICA dos avisos no celular (Web Push) do teste online. A privada fica só no Vault do Supabase. */
export const TESTE_ONLINE_VAPID_PUBLICA = "BDAdJU5pTkwqGAbvCcCGcnBi56NJrm8NWrjR8UdNWTbVNAeW7qOgm9y3wU91WYablPTkbRkk10SfDRRa1qjkSDg";
