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
