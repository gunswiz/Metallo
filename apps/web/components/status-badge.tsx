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

export function StatusBadge({ value, label }: { value: string; label?: string }) {
  return <span className={`status-badge ${tones[value] ?? ""}`}>{label ?? statusLabel(value)}</span>;
}
import { statusLabel } from "@metallo/core";
