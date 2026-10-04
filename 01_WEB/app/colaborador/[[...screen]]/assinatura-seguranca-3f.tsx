"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { KeyRound } from "lucide-react";
import { cancelRegistrationCeremony3f, registerPasskey3f, signatureRequest3f, type SignatureState3f } from
  "@/04_SERVICOS/assinatura-browser-3f";
import styles from "./colaborador.module.css";

const date = (value: string) => new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short", timeStyle: "short", timeZone: "America/Fortaleza",
}).format(new Date(value));

export function AssinaturaSeguranca3f({ getToken }: { getToken: () => Promise<string> }) {
  const [state, setState] = useState<SignatureState3f | null>(null);
  const [busy, setBusy] = useState(false);
  const [canCancel, setCanCancel] = useState(false);
  const cancelableAttempt = useRef(false);
  const requestController = useRef<AbortController | null>(null);
  const attempt = useRef(0);
  const [error, setError] = useState("");
  const [initialError, setInitialError] = useState("");
  const [notice, setNotice] = useState("");
  const refresh = useCallback(async () => {
    const token = await getToken();
    const value = await signatureRequest3f<SignatureState3f>(token, { action: "state" });
    setState(value);
    setInitialError("");
  }, [getToken]);
  useEffect(() => {
    let active = true;
    void (async () => {
      try { const token = await getToken(); const value = await signatureRequest3f<SignatureState3f>(token, { action: "state" });
        if (active) { setState(value); setInitialError(""); } }
      catch { if (active) setInitialError("Métodos temporariamente indisponíveis. Confira sua conexão e tente novamente."); }
    })();
    return () => { active = false; };
  }, [getToken]);
  async function register() {
    if (busy || !state) return;
    const currentAttempt = ++attempt.current;
    const controller = new AbortController();
    requestController.current = controller;
    setBusy(true); setError(""); setNotice("");
    try {
      if (!window.isSecureContext || !window.PublicKeyCredential)
        throw new Error("Este navegador não oferece biometria/passkey.");
      await registerPasskey3f(getToken, {
        onStart: () => { if (attempt.current === currentAttempt) {
          cancelableAttempt.current = true; setCanCancel(true); } },
        onEnd: () => { if (attempt.current === currentAttempt) {
          cancelableAttempt.current = false; setCanCancel(false); } },
        isCancelled: () => attempt.current !== currentAttempt,
        signal: controller.signal,
      });
      if (attempt.current !== currentAttempt) return;
      try {
        await refresh();
        setNotice("Proteção ativada. Suas confirmações comuns anteriores permanecem como estavam.");
      } catch {
        setError("Credencial cadastrada, mas não foi possível atualizar a lista. Use Atualizar métodos.");
      }
    } catch (cause) {
      if (attempt.current !== currentAttempt) return;
      setError(cause instanceof Error && (/^Este navegador|^Abra a prévia/.test(cause.message)) ? cause.message :
        "Cadastro não concluído. Se recusou a janela do Windows, você pode tentar novamente. Nenhuma credencial foi ativada.");
    } finally { if (attempt.current === currentAttempt) {
      cancelableAttempt.current = false; requestController.current = null;
      setCanCancel(false); setBusy(false); } }
  }
  function cancelRegistration() {
    if (!cancelableAttempt.current) return;
    ++attempt.current;
    cancelableAttempt.current = false;
    requestController.current?.abort();
    requestController.current = null;
    cancelRegistrationCeremony3f();
    setCanCancel(false); setBusy(false);
    setError("Tentativa cancelada. Nenhuma credencial foi ativada; você pode tentar novamente.");
  }
  async function reloadMethods() {
    try { await refresh(); setError(""); }
    catch { setInitialError("Métodos temporariamente indisponíveis. Confira sua conexão e tente novamente."); }
  }
  async function revoke(credentialId: string) {
    if (busy || !window.confirm("Revogar este método? Confirmações anteriores serão preservadas.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const token = await getToken();
      await signatureRequest3f(token, { action: "revoke", credential_id: credentialId });
      await refresh(); setNotice("Método revogado. Ele não pode confirmar novas entregas.");
    } catch { setError("Não foi possível revogar agora. Atualize os métodos e tente novamente."); }
    finally { setBusy(false); }
  }
  const active = state?.methods.filter(method => !method.revoked_at) ?? [];
  return <div className={styles.signatureBox} aria-labelledby="assinatura-3f-titulo">
    <div className={styles.epiSectionHead}><div><p className={styles.workLabel}>SEGURANÇA · OPCIONAL</p>
      <h3 id="assinatura-3f-titulo">Assinatura de recebimento</h3></div><KeyRound aria-hidden="true" size={24}/></div>
    <p>Adicione uma verificação pessoal às suas confirmações de recebimento de EPI.</p>
    <p><strong>{state ? active.length ? "Proteção ativada" : "Não configurada" :
      initialError ? "Métodos indisponíveis" : "Consultando métodos…"}</strong></p>
    <p className={styles.signatureNote}>Ativar é uma escolha sua. O acesso ao portal e a confirmação comum continuam disponíveis sem este método. A Metallo não recebe o PIN ou a biometria do seu aparelho.</p>
    {initialError && <p className={styles.signatureNote} role="status">{initialError}</p>}
    {error && <p className={styles.exchangeError} role="alert">{error}</p>}
    {notice && <p className={styles.exchangeSuccess} role="status">{notice}</p>}
    {active.length > 0 && <ul className={styles.signatureMethods} aria-label="Seus métodos cadastrados">
      {active.map((method, index) => <li key={method.id}><div><strong>Passkey {index + 1}</strong>
        <small>Cadastrada em {date(method.created_at)}</small></div>
        <button type="button" disabled={busy} onClick={() => void revoke(method.id)}>Revogar método</button></li>)}
    </ul>}
    {state?.methods.filter(method => method.revoked_at).length ?
      <p className={styles.signatureNote}>Métodos revogados: {state.methods.filter(method => method.revoked_at).length}. As confirmações anteriores permanecem registradas.</p> : null}
    <div className={styles.personalActions}>
      <button type="button" disabled={busy || !state} onClick={() => void register()}>{busy ? "Aguarde…" : active.length ? "Adicionar outro dispositivo" : error ? "Tentar ativar novamente" : "Ativar proteção"}</button>
      {canCancel && <button type="button" onClick={cancelRegistration}>Cancelar tentativa</button>}
      {(error || initialError) && <button type="button" disabled={busy} onClick={() => void reloadMethods()}>Atualizar métodos</button>}
    </div>
    <p className={styles.signatureNote}>Se você recusou a janela do Windows, clique em Ativar proteção novamente. Cancelar tentativa aparece enquanto uma tentativa está em andamento.</p>
    <p className={styles.signatureNote}>Perdeu o aparelho? Revogue o método antigo e cadastre outro. Recuperar o login não restaura esta credencial.</p>
  </div>;
}
