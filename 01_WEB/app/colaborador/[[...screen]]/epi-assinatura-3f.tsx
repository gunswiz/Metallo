"use client";

import { useState } from "react";
import { confirmSignature3f, prepareSignature3f, type PreparedSignature3f } from
  "@/04_SERVICOS/assinatura-browser-3f";
import { consumptionUnit, consumptionUnitLabel } from
  "@/03_FUNCOES_E_LOGICA/unidadesConsumo";
import styles from "./colaborador.module.css";

const date = (value: string) => new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short", timeStyle: "short", timeZone: "America/Fortaleza",
}).format(new Date(value));
function quantity(value: number, raw: string) {
  if (raw.toLowerCase() === "par") return `${value} ${value === 1 ? "par" : "pares"}`;
  return `${value} ${consumptionUnitLabel(consumptionUnit(raw), value)}`;
}
function certificate(value: string | null) {
  if (!value) return "não registrado";
  return value.trim().replace(/^CA[\s:-]*/i, "") || value;
}

export function EpiAssinatura3f({ groupId, getToken, onSigned, onCancel }: {
  groupId: string; getToken: () => Promise<string>; onSigned: () => void; onCancel: () => void;
}) {
  const [prepared, setPrepared] = useState<PreparedSignature3f | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function prepare() {
    if (busy) return;
    setBusy(true); setError(""); setPrepared(null);
    try { setPrepared(await prepareSignature3f(getToken, groupId)); }
    catch { setError(navigator.onLine ?
      "Não foi possível preparar esta entrega. Confira seu método em Meu Perfil e tente novamente." :
      "Sem conexão. Nenhuma assinatura foi registrada."); }
    finally { setBusy(false); }
  }
  async function sign() {
    if (!prepared || busy) return;
    setBusy(true); setError("");
    try { await confirmSignature3f(prepared); setPrepared(null); onSigned(); }
    catch { setError(navigator.onLine ?
      "Assinatura não concluída. Confira o conteúdo e inicie outra verificação se necessário." :
      "Sem conexão. Nenhuma assinatura foi registrada."); setPrepared(null); }
    finally { setBusy(false); }
  }
  return <div className={styles.exchangeForm}>
    <h3>Confirmação com credencial pessoal</h3>
    <p>Confira todo o recebimento antes de usar a passkey. A confirmação comum continua disponível separadamente.</p>
    {error && <p className={styles.exchangeError} role="alert">{error}</p>}
    {prepared ? <div className={styles.signaturePreview}>
      <h4>RECEBIMENTO DE EPI</h4>
      <p>Entrega registrada em {date(prepared.payload.delivered_at)}</p>
      <p>Seu registro pessoal: {prepared.payload.employee_id}</p>
      <p>Referência da entrega: {prepared.payload.group_id}</p>
      <p>Referência desta confirmação: {prepared.payload.transaction_id}</p>
      <ul>{prepared.payload.items.map(item => <li key={item.delivery_id}>
        <strong>{item.item_name}</strong>
        <span> · CA {certificate(item.ca)} · {quantity(item.quantity, item.unit)}</span>
        {item.size && <span> · Tamanho/variante: {item.size}</span>}
        <div className={styles.signatureDetails}>Código: {item.item_code ?? "não registrado"} · Lote: {item.lot ?? "não registrado"} · Marca: {item.brand ?? "não registrada"}</div>
        <div className={styles.signatureDetails}>Referência do item: {item.delivery_id}</div>
      </li>)}</ul>
      <p className={styles.signatureNote}>Esta verificação ficará vinculada exatamente aos dados acima. O sistema confirmará o resultado após conferir sua credencial.</p>
      <div className={styles.exchangeActions}>
        <button type="button" disabled={busy} onClick={onCancel}>Cancelar</button>
        <button type="button" disabled={busy} onClick={() => void sign()}>
          {busy ? "Validando…" : "Confirmar com minha credencial"}</button>
      </div>
    </div> : <div className={styles.exchangeActions}>
      <button type="button" disabled={busy} onClick={onCancel}>Cancelar</button>
      <button type="button" disabled={busy} onClick={() => void prepare()}>
        {busy ? "Consultando…" : "Conferir dados para assinatura"}</button>
    </div>}
  </div>;
}
