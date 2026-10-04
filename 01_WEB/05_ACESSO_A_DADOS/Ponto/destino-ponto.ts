// Para onde as rotas /api/ponto-online e /api/ponto-registros encaminham o pedido.
// Laboratório: servidor local do PC (127.0.0.1). Teste online (Marco 4D): Edge Function ponto-4d do projeto de teste.
// Nenhuma outra combinação é aceita: endereços fixos no código, sem configuração externa.
import { TESTE_ONLINE_COLABORADOR_HOST, TESTE_ONLINE_COLABORADOR_ORIGIN, TESTE_ONLINE_PONTO_4D } from "@/09_CONFIGURACOES/ambiente-teste-online";

export type DestinoPonto = { host: string; origin: string; base: (versao: "v4a" | "v4b") => string; online: boolean };

export function destinoPonto(env: Record<string, string | undefined> = process.env): DestinoPonto | "INDISPONIVEL" | null {
  const lab = env.METALLO_LOCAL_PREVIEW === "1" && env.METALLO_COLABORADOR_PREVIEW === "1";
  const online = env.METALLO_COLABORADOR_TESTE_ONLINE === "1" && env.METALLO_LOCAL_PREVIEW !== "1" && env.METALLO_COLABORADOR_PREVIEW !== "1";
  if (lab) {
    const corePort = env.METALLO_LOAD_TEST_CORE_PORT ?? "3106";
    if (!["3106", "3107"].includes(corePort)) return "INDISPONIVEL";
    return { host: "127.0.0.1:3101", origin: "http://127.0.0.1:3101", base: versao => `http://127.0.0.1:${corePort}/lab-point/${versao}/`, online: false };
  }
  if (online) return { host: TESTE_ONLINE_COLABORADOR_HOST, origin: TESTE_ONLINE_COLABORADOR_ORIGIN, base: versao => `${TESTE_ONLINE_PONTO_4D}/${versao}/`, online: true };
  return null;
}
