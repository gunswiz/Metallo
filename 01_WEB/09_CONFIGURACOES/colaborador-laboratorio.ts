// Somente servidor: valida o modo antes de enviar a chave pública ao cliente.
export function colaboradorEnvironment(env: Record<string, string | undefined>) {
  const visual = env.METALLO_COLABORADOR_VISUAL_PREVIEW === "1";
  const auth = env.METALLO_COLABORADOR_PREVIEW === "1";
  if (visual && auth) throw new Error("Escolha apenas um modo de prévia do Colaborador.");
  if (!visual && !auth) return null;
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
