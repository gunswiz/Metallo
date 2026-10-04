"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Fingerprint, PackageCheck, WifiOff } from "lucide-react";
import type { PersonalDeliveryGroup3d } from "@/05_ACESSO_A_DADOS/Supabase/colaborador-local";
import { usePersonalDetail } from "./use-personal-detail";
import { EpiAssinatura3f } from "./epi-assinatura-3f";
import { signatureRequest3f, type SignatureState3f } from "@/04_SERVICOS/assinatura-browser-3f";
import styles from "./colaborador.module.css";
import { nomeProfissao } from "@/03_FUNCOES_E_LOGICA/Cadastros/profissao";

type Props = {
  read: () => Promise<PersonalDeliveryGroup3d[]>;
  respond: (groupId: string, action: "CONFIRMADO" | "DIVERGENCIA", deliveryId: string | null,
    category: string | null, details: string | null, key: string) => Promise<number>;
  getAccessToken?: () => Promise<string>;
  // Aparelho do almoxarifado: sem biometria do aparelho e saída automática após registrar.
  sharedDevice?: boolean;
  onConfirmed?: () => void;
};
const labels = { ITEM_FALTANDO: "Item faltando", QUANTIDADE: "Quantidade diferente", TAMANHO: "Tamanho diferente",
  VARIANTE: "Variante diferente", NAO_RECEBIDO: "Item não recebido", OUTRO: "Outro" } as const;
type Category = keyof typeof labels;
const stateLabel = { CONFIRMADO: "Recebimento confirmado", DIVERGENCIA: "Divergência informada",
  EM_ANALISE: "Divergência em análise", RESOLVIDA: "Divergência resolvida",
  RECUSA: "Recusa registrada pela Gestão · você ainda pode confirmar ou informar divergência" } as const;
const day = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", dateStyle: "short", timeStyle: "short" }).format(new Date(value));

export function EpiRecebimento({ read, respond, getAccessToken, sharedDevice = false, onConfirmed }: Props) {
  const { state, refresh } = usePersonalDetail(read);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"CONFIRMADO" | "DIVERGENCIA" | null>(null);
  const [deliveryId, setDeliveryId] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [details, setDetails] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [signedGroup, setSignedGroup] = useState<string | null>(null);
  const [signedIds, setSignedIds] = useState<Set<string>>(new Set());
  const [signatureStatus, setSignatureStatus] = useState<"loading" | "ready" | "error">("loading");
  // Biometria do celular (passkey 3F) é o caminho padrão quando o funcionário já a ativou.
  const [hasBiometric, setHasBiometric] = useState(false);
  const key = useRef<string | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    if (!getAccessToken) return;
    let active = true;
    void (async () => {
      try {
        const token = await getAccessToken();
        const result = await signatureRequest3f<SignatureState3f>(token, { action: "state" });
        if (active) { setSignedIds(new Set(result.events.map(event => event.group_id)));
          setHasBiometric(result.methods.some(method => !method.revoked_at)); setSignatureStatus("ready"); }
      } catch { if (active) setSignatureStatus("error"); }
    })();
    return () => { active = false; };
  }, [getAccessToken]);
  const choose = useCallback((groupId: string, action: "CONFIRMADO" | "DIVERGENCIA") => {
    setSignedGroup(null); setSelected(groupId); setMode(action); setDeliveryId(""); setCategory(""); setDetails(""); setAgreed(false);
    setError(""); setNotice(""); key.current = crypto.randomUUID();
  }, []);
  const biometricDefault = !sharedDevice && Boolean(getAccessToken) && signatureStatus === "ready" && hasBiometric;
  function dismiss() { setSelected(null); setMode(null); setError(""); key.current = null; }
  async function send(groupId: string) {
    if (lock.current || !mode || (mode === "CONFIRMADO" && !agreed) ||
      (mode === "DIVERGENCIA" && (!deliveryId || !category || !details.trim()))) return;
    lock.current = true; setBusy(true); setError("");
    try {
      await respond(groupId, mode, mode === "DIVERGENCIA" ? deliveryId : null,
        mode === "DIVERGENCIA" ? category : null, mode === "DIVERGENCIA" ? details.trim() : null,
        key.current ??= crypto.randomUUID());
      setNotice(mode === "CONFIRMADO" ? "Recebimento confirmado." : "Divergência informada à Gestão.");
      dismiss(); refresh(); onConfirmed?.();
    } catch {
      setError(typeof navigator !== "undefined" && !navigator.onLine ?
        "Não foi possível registrar agora. Verifique a conexão." :
        "Não foi possível concluir agora. Atualize os dados e tente novamente.");
      refresh();
    } finally { lock.current = false; setBusy(false); }
  }
  return <section className={styles.personalCard} aria-labelledby="epi-recebimento-heading">
    <div className={styles.epiSectionHead}><div><p className={styles.workLabel}>ENTREGAS DO LABORATÓRIO</p><h2 id="epi-recebimento-heading">Recebimento de EPIs</h2></div><PackageCheck aria-hidden="true" size={25}/></div>
    <p>A Gestão registra a entrega após a entrega física. Você pode confirmar o recebimento ou informar uma divergência. Sua confirmação não cria uma entrega nem constitui assinatura digital qualificada.</p>
    {notice&&<p className={styles.exchangeSuccess} role="status">{notice}</p>}
    {error&&<p className={styles.exchangeError} role="alert">{error}</p>}
    {state.status === "loading" ? <p role="status">Consultando suas entregas…</p> :
      state.status === "error" ? <div role="alert"><WifiOff aria-hidden="true" size={25}/><p>Entregas temporariamente indisponíveis.</p><button type="button" onClick={refresh}>Tentar novamente</button></div> :
      state.data.length === 0 ? <p>Nenhuma entrega deste fluxo registrada para você.</p> :
      <ul className={styles.exchangeList}>{state.data.map(group => <li key={group.group_id}>
        <div><strong>Entrega registrada em {day(group.delivered_at)}</strong>
          <span className={styles.exchangeStatus}>{signedIds.has(group.group_id) && group.feedback_status === "CONFIRMADO" ?
            "Confirmado com biometria do celular" : group.feedback_status === "CONFIRMADO" && getAccessToken && signatureStatus !== "ready" ?
            "Recebimento confirmado · tipo de confirmação indisponível" : group.feedback_status ? stateLabel[group.feedback_status] : "Confirmação pendente"}</span>
          {group.feedback_at && <small>Manifestação registrada em {day(group.feedback_at)}</small>}
          {group.public_message && <p>Mensagem da Gestão: {group.public_message}</p>}
          <small>Função no registro: {nomeProfissao(group.profession)}</small>
          <ul aria-label="Itens registrados nesta entrega">{group.items.map(item => <li key={item.delivery_id}>
            {item.item_name} · {item.quantity} {item.unit}{item.variant ? ` · tamanho/variante ${item.variant}` : ""}{item.ca_number ? ` · CA ${item.ca_number}` : ""}
          </li>)}</ul>
          {selected === group.group_id && mode && <div className={styles.exchangeForm}>
            <h3>{mode === "CONFIRMADO" ? "Conferir e confirmar recebimento" : "Informar divergência"}</h3>
            {mode === "CONFIRMADO" ? <label><input type="checkbox" checked={agreed} onChange={event => setAgreed(event.target.checked)}/> Conferi os itens e confirmo o recebimento registrado acima.</label> : <>
              <label htmlFor={`delivery-${group.group_id}`}>Item da divergência</label>
              <select id={`delivery-${group.group_id}`} value={deliveryId} onChange={event => setDeliveryId(event.target.value)} required>
                <option value="">Selecione o item</option>{group.items.map(item => <option key={item.delivery_id} value={item.delivery_id}>{item.item_name} · {item.variant ?? "sem tamanho"}</option>)}
              </select>
              <label htmlFor={`category-${group.group_id}`}>O que aconteceu?</label>
              <select id={`category-${group.group_id}`} value={category} onChange={event => setCategory(event.target.value as Category)} required>
                <option value="">Selecione</option>{(Object.entries(labels) as [Category,string][]).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <label htmlFor={`details-${group.group_id}`}>Descreva a divergência</label>
              <textarea id={`details-${group.group_id}`} value={details} onChange={event => setDetails(event.target.value)} maxLength={240} rows={3} required/>
              <small>A entrega original será preservada. O relato não gera punição ou cobrança automática.</small>
            </>}
            <div className={styles.exchangeActions}><button type="button" onClick={dismiss} disabled={busy}>Cancelar</button>
              <button type="button" onClick={() => void send(group.group_id)} disabled={busy || (mode === "CONFIRMADO" ? !agreed : !deliveryId || !category || !details.trim())}>{busy ? "Enviando…" : mode === "CONFIRMADO" ? "Confirmar recebimento" : "Enviar divergência"}</button></div>
          </div>}
          {signedGroup === group.group_id && getAccessToken && <EpiAssinatura3f groupId={group.group_id}
            getToken={getAccessToken} onCancel={() => setSignedGroup(null)} onSigned={() => {
              setSignedIds(previous => new Set(previous).add(group.group_id));
              setSignedGroup(null); setNotice("Recebimento confirmado com biometria do celular."); refresh();
            }}/>}
        </div>
        {selected !== group.group_id && signedGroup !== group.group_id && (group.feedback_status === null || group.feedback_status === "RESOLVIDA" || group.feedback_status === "RECUSA") &&
          <div className={styles.exchangeActions}>
            {biometricDefault ? <>
              <button type="button" className={styles.biometricPrimary} onClick={() => { setSelected(null); setMode(null); setSignedGroup(group.group_id); setError(""); setNotice(""); }}><Fingerprint aria-hidden="true" size={20}/> Confirmar com biometria</button>
              <button type="button" onClick={() => choose(group.group_id,"CONFIRMADO")}>Confirmar sem biometria</button>
            </> : <button type="button" onClick={() => choose(group.group_id,"CONFIRMADO")}>Confirmar recebimento</button>}
            <button type="button" onClick={() => choose(group.group_id,"DIVERGENCIA")}>Informar divergência</button>
          </div>}
        {selected !== group.group_id && signedGroup !== group.group_id && (group.feedback_status === null || group.feedback_status === "RESOLVIDA" || group.feedback_status === "RECUSA") &&
          !sharedDevice && getAccessToken && signatureStatus === "ready" && !hasBiometric &&
          <p className={styles.signatureNote}>Dica: ative a biometria do celular em <Link href="/colaborador/perfil#perfil-seguranca">Meu Perfil → Segurança</Link> para confirmar entregas com a sua digital, rosto ou senha da tela.</p>}
      </li>)}</ul>}
  </section>;
}
