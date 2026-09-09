// Same recommendations as the Mobile's epi_catalog.dart. Stable system keys
// keep the kit intact when an administrator edits a visible item code.
export function recommendedKit(profession: string): Map<string, number> {
  const p = profession.toLowerCase();
  let epi = ["EPI-CAP", "EPI-OCU", "EPI-AUR", "EPI-BOT"];
  if (p === "soldador") epi.push("EPI-LUV-RASPA", "EPI-MASC-SOLDA", "EPI-AVENTAL");
  if (["montador", "encarregado", "ajudante"].includes(p)) epi.push("EPI-LUV-RASPA");
  if (p.includes("operador de munck")) epi = ["EPI-LUV-RASPA", "EPI-AUR", "EPI-OCU", "EPI-BOT"];
  if (p === "pintor") epi.push("EPI-RESP-PINT");
  const result = new Map(epi.map((code) => [code, 1]));
  result.set(p === "encarregado" ? "FARD-AZUL" : "FARD-CINZA", 2);
  if (["montador", "encarregado"].includes(p)) for (const code of ["PES-TRENA", "PES-ESQ", "PES-RISC", "PES-LAPIS"]) result.set(code, 1);
  if (p === "soldador") result.set("PES-BAT-SOLDA", 1);
  return result;
}

export function compatibleRequestBatches<T extends { item_id: string; variant: string | null; quantity: number }>(
  request: { item_id: string; requested_variant: string | null; quantity: number }, batches: T[],
): T[] {
  return batches.filter((batch) => batch.item_id === request.item_id && batch.quantity >= request.quantity &&
    (request.requested_variant === null || batch.variant === request.requested_variant));
}
