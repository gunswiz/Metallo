const tones: Record<string, "good" | "warn" | "bad" | ""> = {
  active: "good",
  available: "good",
  in_use: "good",
  pending: "warn",
  fulfilled: "good",
  cancelled: "",
  maintenance: "warn",
  damaged: "bad",
  lost: "bad",
  retired: "bad",
  returned: "",
  replaced: "",
  consumed: "",
};

const labels: Record<string, string> = {
  active: "Ativo",
  available: "Disponível",
  in_use: "Em uso",
  pending: "Pendente",
  fulfilled: "Atendida",
  cancelled: "Cancelada",
  maintenance: "Manutenção",
  damaged: "Danificado",
  lost: "Perdido",
  retired: "Baixado",
  returned: "Devolvido",
  replaced: "Substituído",
  consumed: "Consumido",
};

export function StatusBadge({ value, label }: { value: string; label?: string }) {
  return <span className={`status-badge ${tones[value] ?? ""}`}>{label ?? labels[value] ?? value}</span>;
}
