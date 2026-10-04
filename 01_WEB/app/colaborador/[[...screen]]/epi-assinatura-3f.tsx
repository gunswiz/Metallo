"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Fingerprint, HardHat, KeyRound } from "lucide-react";
import { biometricSupported, confirmSignature3f, finishRegistration3f, PasswordConfirmError, prepareRegistration3f,
  prepareSignature3f, signatureRequest3f, type PreparedRegistration3f, type PreparedSignature3f, type SignatureState3f } from
  "@/04_SERVICOS/assinatura-browser-3f";
import type { PersonalDeliveryGroup3d } from "@/05_ACESSO_A_DADOS/Supabase/colaborador-local";
import { TelaCheia } from "./tela-cheia";
import styles from "./simples.module.css";

// Marco 3J: confirmar o recebimento SEMPRE exige a digital (passkey 3F) OU a senha da conta.
// - Sem digital cadastrada: o cadastro acontece aqui mesmo (sem ir ao Perfil) e, em seguida, um toque confirma.
// - O desafio é buscado quando a tela abre; o toque no botão chama a digital imediatamente.
// - Aparelho do almoxarifado: somente senha (a digital do aparelho não é da pessoa).
export function itemLine(item: { quantity: number; unit: string; variant: string | null; ca_number: string | null }) {
  const unit = item.unit === "par" ? (item.quantity === 1 ? "par" : "pares") : item.unit === "un" ? (item.quantity === 1 ? "unidade" : "unidades") : item.unit;
  return [`${item.quantity} ${unit}`, item.variant ? `tamanho ${item.variant}` : "", item.ca_number ? `CA ${item.ca_number.replace(/^CA[\s:-]*/i, "")}` : ""]
    .filter(Boolean).join(" · ");
}
type Phase = "preparando" | "digital" | "cadastrar" | "senha" | "pronto";
const fingerprintFail = "A digital não foi confirmada. Toque de novo ou use sua senha.";

export function ConfirmarRecebimento({ group, getAccessToken, sharedDevice = false, confirmWithPassword, onDone, onClose }: {
  group: PersonalDeliveryGroup3d;
  getAccessToken?: () => Promise<string>;
  sharedDevice?: boolean;
  confirmWithPassword?: (groupId: string, password: string, key: string) => Promise<void>;
  onDone: (method: "digital" | "senha") => void;
  onClose: () => void;
}) {
  const canFingerprint = !sharedDevice && Boolean(getAccessToken) && biometricSupported();
  const [phase, setPhase] = useState<Phase>(canFingerprint ? "preparando" : "senha");
  const [sign, setSign] = useState<PreparedSignature3f | null>(null);
  const [registration, setRegistration] = useState<PreparedRegistration3f | null>(null);
  const [justRegistered, setJustRegistered] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [method, setMethod] = useState<"digital" | "senha" | null>(null);
  const key = useRef(crypto.randomUUID());
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const prepare = useCallback(async () => {
    if (!getAccessToken) return;
    try {
      const token = await getAccessToken();
      const state = await signatureRequest3f<SignatureState3f>(token, { action: "state" });
      if (state.events.some(event => event.group_id === group.group_id)) { if (alive.current) { setMethod("digital"); setPhase("pronto"); } return; }
      if (state.methods.some(row => !row.revoked_at)) {
        const prepared = await prepareSignature3f(getAccessToken, group.group_id);
        if (alive.current) { setSign(prepared); setPhase("digital"); }
      } else {
        const prepared = await prepareRegistration3f(getAccessToken);
        if (alive.current) { setRegistration(prepared); setPhase("cadastrar"); }
      }
    } catch {
      if (alive.current) { setError("Não foi possível preparar a digital agora. Use sua senha."); setPhase("senha"); }
    }
  }, [getAccessToken, group.group_id]);
  useEffect(() => {
    if (!canFingerprint) return;
    const timer = window.setTimeout(() => void prepare(), 0);
    return () => window.clearTimeout(timer);
  }, [canFingerprint, prepare]);

  async function confirmFingerprint() {
    if (!sign || busy) return;
    setBusy(true); setError("");
    try {
      await confirmSignature3f(sign);
      if (!alive.current) return;
      setMethod("digital"); setPhase("pronto"); onDone("digital");
    } catch {
      if (!alive.current) return;
      setError(navigator.onLine ? fingerprintFail : "Sem internet. Nada foi registrado. Tente de novo.");
      setSign(null);
      try { const again = await prepareSignature3f(getAccessToken!, group.group_id); if (alive.current) setSign(again); }
      catch { if (alive.current) setPhase("senha"); }
    } finally { if (alive.current) setBusy(false); }
  }
  async function registerFingerprint() {
    if (!registration || busy) return;
    setBusy(true); setError("");
    try {
      await finishRegistration3f(registration);
      if (!alive.current) return;
      setJustRegistered(true); setRegistration(null);
      const prepared = await prepareSignature3f(getAccessToken!, group.group_id);
      if (alive.current) { setSign(prepared); setPhase("digital"); }
    } catch {
      if (!alive.current) return;
      setError("A digital não foi cadastrada. Toque de novo ou use sua senha.");
      setRegistration(null);
      try { const again = await prepareRegistration3f(getAccessToken!); if (alive.current) setRegistration(again); }
      catch { if (alive.current) setPhase("senha"); }
    } finally { if (alive.current) setBusy(false); }
  }
  async function confirmPasswordNow() {
    if (!confirmWithPassword || !password || busy) return;
    setBusy(true); setError("");
    try {
      await confirmWithPassword(group.group_id, password, key.current);
      if (!alive.current) return;
      setPassword(""); setMethod("senha"); setPhase("pronto"); onDone("senha");
    } catch (failure) {
      if (!alive.current) return;
      const code = failure instanceof PasswordConfirmError ? failure.code : "falha";
      setError(code === "senha_incorreta" ? "Senha incorreta. Tente de novo." :
        code === "muitas_tentativas" ? "Muitas tentativas erradas. Espere 15 minutos ou use a digital." :
        navigator.onLine ? "Não deu certo agora. Tente de novo em instantes." : "Sem internet. Nada foi registrado. Tente de novo.");
      setPassword("");
    } finally { if (alive.current) setBusy(false); }
  }

  if (phase === "pronto") return <TelaCheia title="Recebimento confirmado" onBack={onClose} backLabel="Fechar">
    <div className={styles.done} role="status"><CheckCircle2 aria-hidden="true" size={72}/>
      <h2>Pronto!</h2><p>Recebimento confirmado {method === "digital" ? "com a sua digital" : "com a sua senha"}.</p></div>
    <button type="button" className={styles.bigGo} onClick={onClose}>OK</button>
  </TelaCheia>;
  return <TelaCheia title="Confirmar recebimento" onBack={onClose} busy={busy}>
    <p>Confira os itens que você recebeu:</p>
    <ul className={styles.items} aria-label="Itens desta entrega">{group.items.map(item => <li key={item.delivery_id}>
      <HardHat aria-hidden="true" size={26}/><span>{item.item_name}<small>{itemLine(item)}</small></span></li>)}</ul>
    {error && <p className={styles.fail} role="alert">{error}</p>}
    {phase === "preparando" && <p className={styles.wait} role="status">Preparando a digital…</p>}
    {phase === "digital" && <div className={styles.bigActions}>
      {justRegistered && <p className={styles.ok} role="status">Digital cadastrada! Agora toque mais uma vez para confirmar.</p>}
      <button type="button" className={styles.bigOk} onClick={() => void confirmFingerprint()} disabled={busy || !sign}>
        <Fingerprint aria-hidden="true" size={30}/>{busy ? "Aguardando a digital…" : "Confirmar com a digital"}</button>
      {confirmWithPassword && <button type="button" className={styles.bigSoft} onClick={() => { setError(""); setPhase("senha"); }} disabled={busy}>
        <KeyRound aria-hidden="true" size={22}/>Usar minha senha</button>}
    </div>}
    {phase === "cadastrar" && <div className={styles.bigActions}>
      <p className={styles.wait}>Na primeira vez, o celular vai pedir sua digital para guardar. Depois é só tocar.</p>
      <button type="button" className={styles.bigOk} onClick={() => void registerFingerprint()} disabled={busy || !registration}>
        <Fingerprint aria-hidden="true" size={30}/>{busy ? "Aguardando a digital…" : "Usar minha digital"}</button>
      {confirmWithPassword && <button type="button" className={styles.bigSoft} onClick={() => { setError(""); setPhase("senha"); }} disabled={busy}>
        <KeyRound aria-hidden="true" size={22}/>Usar minha senha</button>}
    </div>}
    {phase === "senha" && (confirmWithPassword ? <form className={styles.bigActions} onSubmit={event => { event.preventDefault(); void confirmPasswordNow(); }}>
      <label className={styles.field}>Digite sua senha para confirmar
        <input type="password" autoComplete={sharedDevice ? "off" : "current-password"} value={password}
          onChange={event => setPassword(event.target.value)} maxLength={200} required/></label>
      <button type="submit" className={styles.bigOk} disabled={busy || !password}><KeyRound aria-hidden="true" size={26}/>{busy ? "Confirmando…" : "Confirmar com a senha"}</button>
      {canFingerprint && <button type="button" className={styles.bigSoft} disabled={busy}
        onClick={() => { setError(""); setPassword(""); setPhase("preparando"); void prepare(); }}><Fingerprint aria-hidden="true" size={22}/>Usar a digital</button>}
    </form> : <p className={styles.fail} role="alert">Confirmação indisponível neste aparelho. Procure o almoxarifado.</p>)}
    <p className={styles.small}>Ao confirmar, você declara que recebeu os itens acima. Se faltou algo, volte e toque em “Falta algo”.</p>
  </TelaCheia>;
}
