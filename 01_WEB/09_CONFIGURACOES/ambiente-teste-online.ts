// Ambiente de TESTE ONLINE do Metallo (projeto Supabase "metallo-teste", só dados fictícios).
// Os endereços são fixos no código: nenhuma configuração consegue apontar o Colaborador
// ou os recursos novos para o projeto de produção (Almoxarifado Online).
export const LAB_SUPABASE_URL = "http://127.0.0.1:54321";
export const TESTE_ONLINE_SUPABASE_URL = "https://cvimwiqokkujfhwynhmt.supabase.co";

/** Recursos ainda não liberados na produção (EPI 3D–3I, comunicados, itens pessoais). */
export function recursosNovosLiberados(supabaseUrl: string | undefined) {
  return supabaseUrl === LAB_SUPABASE_URL || supabaseUrl === TESTE_ONLINE_SUPABASE_URL;
}

export function ehTesteOnline(supabaseUrl: string | undefined) {
  return supabaseUrl === TESTE_ONLINE_SUPABASE_URL;
}
