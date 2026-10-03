import { TESTE_ONLINE_SUPABASE_URL } from "./ambiente-teste-online";

// Somente servidor: valida o modo antes de enviar a chave pública ao cliente.
export function colaboradorEnvironment(env: Record<string, string | undefined>) {
  const visual = env.METALLO_COLABORADOR_VISUAL_PREVIEW === "1";
  const auth = env.METALLO_COLABORADOR_PREVIEW === "1";
  const online = env.METALLO_COLABORADOR_TESTE_ONLINE === "1";
  if ([visual, auth, online].filter(Boolean).length > 1) throw new Error("Escolha apenas um modo de prévia do Colaborador.");
  if (!visual && !auth && !online) return null;
  if (online) {
    // Teste online: endereço fixo do projeto de teste e somente chave publicável (nunca secreta).
    if (env.METALLO_LOCAL_PREVIEW === "1") throw new Error("O teste online não roda como prévia local.");
    const key = env.METALLO_COLABORADOR_TESTE_KEY ?? "";
    if (!/^sb_publishable_[A-Za-z0-9_-]{10,200}$/.test(key)) throw new Error("Teste online exige a chave publicável do projeto de teste.");
    return { demo: false, anonKey: key, online: true, baseUrl: TESTE_ONLINE_SUPABASE_URL };
  }
  if (env.METALLO_LOCAL_PREVIEW !== "1") throw new Error("Prévia exclusivamente local.");
  if (visual) return { demo: true, anonKey: "visual-only" };
  if (env.METALLO_COLABORADOR_LAB_URL !== "http://127.0.0.1:54321") {
    throw new Error("Auth 1B bloqueado: endereço diferente do laboratório autorizado.");
  }
  const key = env.METALLO_COLABORADOR_LAB_ANON_KEY ?? "";
  let role: unknown;
  try { role = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role; } catch { /* Rejeitar. */ }
  if (role !== "anon") throw new Error("Auth 1B exige a chave pública anon do laboratório.");
  return { demo: false, anonKey: key };
}
