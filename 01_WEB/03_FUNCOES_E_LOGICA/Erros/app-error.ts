export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

const knownMessages: Record<string, string> = {
  insufficient_stock: "Estoque insuficiente para concluir a operação.",
  forbidden_role: "Seu perfil não pode executar esta operação.",
  forbidden_team: "A operação está fora da equipe permitida para seu perfil.",
  same_team_transfer: "Origem e destino precisam ser diferentes.",
  request_not_pending: "A pendência já foi atendida ou cancelada.",
  inactive_or_missing_profile: "Seu perfil está inativo ou incompleto.",
};

export function toAppError(error: unknown, fallback = "Não foi possível concluir a operação.") {
  const text = error instanceof Error ? error.message : String(error ?? "");
  const code = Object.keys(knownMessages).find((key) => text.includes(key)) ?? "unexpected";
  return new AppError(code, knownMessages[code] ?? fallback, error);
}

// Mensagens públicas para falhas de leitura. Detalhes do banco e da pilha ficam fora da tela.
export function classifyLoadFailure(error: unknown) {
  const chain: unknown[] = [];
  let current = error;
  for (let depth = 0; depth < 3 && current; depth++) {
    chain.push(current);
    current = typeof current === "object" && "cause" in current ? current.cause : null;
  }
  const details = chain.map(value => {
    if (typeof value === "string") return value;
    if (!value || typeof value !== "object") return "";
    const item = value as { code?: unknown; status?: unknown; name?: unknown; message?: unknown };
    return [item.code, item.status, item.name, item.message].map(part => String(part ?? "")).join(" ");
  }).join(" ").toLowerCase();
  if (/\b(401|pgrst301|invalid_jwt|jwt expired|session expired|authsessionmissingerror)\b/.test(details))
    return { kind: "session", title: "Sessão expirada", message: "Entre novamente para consultar os funcionários." } as const;
  if (/\b(403|42501|permission denied|forbidden|acesso negado)\b/.test(details))
    return { kind: "forbidden", title: "Acesso negado", message: "Seu perfil não possui permissão para consultar estes dados." } as const;
  if (/\b(404|pgrst202)\b/.test(details))
    return { kind: "not_found", title: "Serviço não encontrado", message: "A consulta de funcionários não está disponível neste laboratório." } as const;
  if (/\b(409|23505)\b/.test(details))
    return { kind: "conflict", title: "Conflito ao carregar", message: "Os dados mudaram durante a consulta. Tente novamente." } as const;
  if (/\b(422|pgrst100)\b/.test(details))
    return { kind: "invalid", title: "Consulta inválida", message: "Não foi possível interpretar esta consulta. Tente novamente." } as const;
  if (/\b(aborterror|timeout|timed out|etimedout)\b/.test(details))
    return { kind: "timeout", title: "Tempo de espera excedido", message: "O laboratório demorou a responder. Tente novamente." } as const;
  if (/\b(failed to fetch|fetch failed|econnrefused|econnreset|enotfound|networkerror)\b/.test(details))
    return { kind: "connection", title: "Sem conexão", message: "O serviço local está indisponível. Confira o laboratório e tente novamente." } as const;
  return { kind: "internal", title: "Erro ao carregar", message: "Não foi possível consultar os funcionários agora. Tente novamente." } as const;
}
