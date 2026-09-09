"use client";

import { useState } from "react";
import Link from "next/link";
import { SubmitButton } from "@/02_COMPONENTES_VISUAIS/submit-button";

const labels = {
  epi: { title: "EPI", variant: "Tamanho/modelo (opcional)", example: "Ex.: 42, Claro ou Escuro" },
  uniform: { title: "Fardamento", variant: "Tamanho (opcional)", example: "Ex.: M, G ou XXG" },
  personal_tool: { title: "Item pessoal", variant: "Variação (opcional)", example: "Ex.: 5 m" },
} as const;

export function EpiItemForm({ action, initialKind }: { action: (formData: FormData) => Promise<void>; initialKind: keyof typeof labels }) {
  const [kind, setKind] = useState<keyof typeof labels>(initialKind);
  return <form action={action} className="form-grid">
    <label>Tipo<select name="kind" value={kind} onChange={(event) => setKind(event.target.value as keyof typeof labels)}><option value="epi">EPI</option><option value="uniform">Fardamento</option><option value="personal_tool">Item pessoal</option></select></label>
    <label>Código<input name="code" maxLength={50} placeholder={kind === "epi" ? "EPI-NOVO" : kind === "uniform" ? "FARD-NOVO" : "PES-NOVO"} required /></label>
    <label className="full">Nome<input name="name" maxLength={140} placeholder={`Nome do ${labels[kind].title.toLowerCase()}`} required /></label>
    <label>Unidade<input name="unit" defaultValue={kind === "uniform" ? "conjunto" : "un"} maxLength={20} required /></label>
    <label>Estoque mínimo<input name="minimumStock" type="number" min="0" defaultValue="0" required /></label>
    {kind === "epi" && <label>C.A.<input name="caNumber" maxLength={60} placeholder="Certificado de Aprovação" /></label>}
    <label>Marca / modelo<input name="brandModel" maxLength={140} /></label>
    <div className="form-divider full"><strong>Entrada inicial opcional</strong><span>O cadastro cria o tipo. Preencha abaixo apenas se já houver unidades para entrar na COSEM.</span></div>
    <label>Quantidade inicial<input name="initialQuantity" type="number" min="0" defaultValue="0" required /></label>
    <label>{labels[kind].variant}<input name="variant" maxLength={80} placeholder={labels[kind].example} /></label>
    <label className="full">Lote (opcional)<input name="lotNumber" maxLength={100} /></label>
    <div className="form-actions"><Link className="button ghost" href={kind === "personal_tool" ? "/ferramentas" : `/epis${kind === "uniform" ? "?kind=uniform" : ""}`}>Cancelar</Link><SubmitButton pendingLabel="Cadastrando…">Cadastrar {labels[kind].title.toLowerCase()}</SubmitButton></div>
  </form>;
}
