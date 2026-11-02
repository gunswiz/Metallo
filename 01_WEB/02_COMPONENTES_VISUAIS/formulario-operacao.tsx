"use client";

import { startTransition, useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import type { OperationState } from "@/03_FUNCOES_E_LOGICA/executarOperacaoValidada";
export type OperationAction = (previous: OperationState, formData: FormData) => Promise<OperationState>;
const subscribeHydration = () => () => {};
const validKey = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

function AtualizarAposConfirmacao({ destination }: { destination: string }) {
  const router = useRouter();
  useEffect(() => { router.replace(destination); router.refresh(); }, [router, destination]);
  return <p>Atualizando os registros…</p>;
}

export function OperationForm({ action, children, label, pendingLabel = "Salvando…", operationKeyScope,
  initialOperationKey, newOperationLabel = "Iniciar outra entrega", refreshOnComplete = false, completionHref }: {
  action: OperationAction; children: React.ReactNode; label: string; pendingLabel?: string;
  operationKeyScope?: string; initialOperationKey?: string;
  newOperationLabel?: string | null;
  refreshOnComplete?: boolean; completionHref?: string;
}) {
  const execute = async (previous: OperationState, data: FormData): Promise<OperationState> => {
    let result: OperationState;
    try { result = await action(previous, data); }
    catch (error) {
      unstable_rethrow(error);
      return { error: "Não foi possível receber a confirmação. A tentativa foi preservada. Confira os registros antes de reenviar." };
    }
    if (operationKeyScope && result.completedKey && result.completedKey === data.get("idempotencyKey")) {
      try {
        // Não apaga uma tentativa nova iniciada em outra aba durante o envio.
        if (localStorage.getItem(operationKeyScope) === result.completedKey) localStorage.removeItem(operationKeyScope);
      } catch { return { ...result, error: "Operação confirmada, mas não foi possível encerrar a tentativa neste navegador. Confira os registros antes de iniciar outra." }; }
    }
    return result;
  };
  const [actionState, submit, actionPending] = useActionState(execute, {});
  const [confirmedState, setConfirmedState] = useState<OperationState>({});
  const [confirmedPending, setConfirmedPending] = useState(false);
  const confirmedRunning = useRef(false);
  const state = operationKeyScope ? confirmedState : actionState;
  const pending = operationKeyScope ? confirmedPending : actionPending;
  const operationKeyInput = useRef<HTMLInputElement>(null);
  const [storageError, setStorageError] = useState(false);
  const [changedElsewhere, setChangedElsewhere] = useState(false);
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  useEffect(() => {
    if (!operationKeyScope || !initialOperationKey || state.completedKey) return;
    try {
      const existing = localStorage.getItem(operationKeyScope);
      const current = existing || initialOperationKey;
      if (!existing) localStorage.setItem(operationKeyScope, current);
      if (operationKeyInput.current) {
        operationKeyInput.current.defaultValue = current;
        operationKeyInput.current.value = current;
      }
    } catch { /* The server still enforces one key per submitted request. */ }
  }, [operationKeyScope, initialOperationKey, state.completedKey]);
  const startNewOperation = () => {
    if (!operationKeyScope) return;
    let next: string;
    try { next = crypto.randomUUID(); localStorage.setItem(operationKeyScope, next); }
    catch { setStorageError(true); return; }
    if (operationKeyInput.current) { operationKeyInput.current.defaultValue = next; operationKeyInput.current.value = next; }
    setStorageError(false);
    setChangedElsewhere(false);
  };
  if (state.completedKey) return <div className="alert success" role="status">
    <p>Operação confirmada pelo sistema. Esta tentativa foi concluída.</p>
    {refreshOnComplete && (completionHref || state.destination) && <AtualizarAposConfirmacao destination={completionHref || state.destination!}/>}
    {state.error && <p role="alert">{state.error}</p>}
    {state.destination && <a className="button secondary" href={state.destination}>Ver registros atualizados</a>}
  </div>;
  // Dispatch explicitly so validation failures do not reset the entered fields.
  // The action still supplies the POST fallback before hydration.
  return <form action={submit} onSubmit={(event) => {
    event.preventDefault();
    if (pending || confirmedRunning.current || (operationKeyScope && !hydrated)) return;
    const data = new FormData(event.currentTarget);
    if (operationKeyScope) {
      try {
        const current = String(data.get("idempotencyKey") ?? "");
        if (!validKey(current)) { setStorageError(true); return; }
        const stored = localStorage.getItem(operationKeyScope);
        if (stored && stored !== current) { setChangedElsewhere(true); return; }
        if (!stored) localStorage.setItem(operationKeyScope, current);
        setStorageError(false);
        setChangedElsewhere(false);
      } catch { setStorageError(true); return; }
    }
    if (operationKeyScope) {
      // A confirmação explícita não participa da transição da atualização RSC.
      // O runtime pode atualizar a página antes de entregar o retorno da ação.
      confirmedRunning.current = true; setConfirmedPending(true);
      void execute(confirmedState, data).then(setConfirmedState).finally(() => {
        confirmedRunning.current = false; setConfirmedPending(false);
      });
    } else startTransition(() => submit(data));
  }}>
    {state.error && <div className="alert error" role="alert">{state.error}</div>}
    {storageError && <div className="alert error" role="alert">Não foi possível guardar esta tentativa no navegador. Confira o armazenamento local antes de enviar novamente.</div>}
    {changedElsewhere && <div className="alert error" role="alert">Outra aba iniciou uma nova tentativa. Atualize esta página e confira os registros antes de reenviar.</div>}
    <fieldset disabled={pending || Boolean(operationKeyScope && !hydrated)} className="operation-fields form-grid">
      {operationKeyScope && <input ref={operationKeyInput} type="hidden" name="idempotencyKey"/>}
      {children}
      <div className="form-actions"><button className="button primary" type="submit" disabled={pending}>{pending ? pendingLabel : label}</button></div>
      {operationKeyScope && <div className="full">{newOperationLabel && <button type="button" className="button secondary" onClick={startNewOperation} disabled={pending}>
        {newOperationLabel}
      </button>}<p className="muted">Atualizar a página mantém a mesma tentativa. Confira os registros antes de repetir.{newOperationLabel ? ` Use “${newOperationLabel}” somente para uma operação diferente.` : ""}</p></div>}
    </fieldset>
  </form>;
}
