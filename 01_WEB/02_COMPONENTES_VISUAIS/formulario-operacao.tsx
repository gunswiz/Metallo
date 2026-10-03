"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import type { OperationState } from "@/03_FUNCOES_E_LOGICA/executarOperacaoValidada";
export type OperationAction = (previous: OperationState, formData: FormData) => Promise<OperationState>;

export function OperationForm({ action, children, label, pendingLabel = "Salvando…", operationKeyScope,
  initialOperationKey }: {
  action: OperationAction; children: React.ReactNode; label: string; pendingLabel?: string;
  operationKeyScope?: string; initialOperationKey?: string;
}) {
  const [state, submit, pending] = useActionState(action, {});
  const operationKeyInput = useRef<HTMLInputElement>(null);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    if (!operationKeyScope || !initialOperationKey) return;
    try {
      const existing = localStorage.getItem(operationKeyScope);
      if (existing && operationKeyInput.current) operationKeyInput.current.value = existing;
      else localStorage.setItem(operationKeyScope, initialOperationKey);
    } catch { /* The server still enforces one key per submitted request. */ }
  }, [operationKeyScope, initialOperationKey]);
  const startNewOperation = () => {
    if (!operationKeyScope) return;
    const next = crypto.randomUUID();
    try { localStorage.setItem(operationKeyScope, next); }
    catch { setStorageError(true); return; }
    if (operationKeyInput.current) operationKeyInput.current.value = next;
    setStorageError(false);
  };
  // Dispatch explicitly so validation failures do not reset the entered fields.
  // The action still supplies the POST fallback before hydration.
  return <form action={submit} onSubmit={(event) => {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    if (operationKeyScope) {
      try {
        const current = String(data.get("idempotencyKey") ?? "");
        if (!current) { setStorageError(true); return; }
        if (!localStorage.getItem(operationKeyScope)) localStorage.setItem(operationKeyScope, current);
        setStorageError(false);
      } catch { setStorageError(true); return; }
    }
    startTransition(() => submit(data));
  }}>
    {state.error && <div className="alert error" role="alert">{state.error}</div>}
    {storageError && <div className="alert error" role="alert">Não foi possível guardar esta tentativa no navegador. Ative o armazenamento local para registrar a entrega sem risco de duplicação.</div>}
    <fieldset disabled={pending} className="operation-fields form-grid">
      {operationKeyScope && <input ref={operationKeyInput} type="hidden" name="idempotencyKey"
        defaultValue={initialOperationKey}/>}
      {children}
      <div className="form-actions"><button className="button primary" type="submit" disabled={pending}>{pending ? pendingLabel : label}</button></div>
      {operationKeyScope && <div className="full"><button type="button" className="button secondary" onClick={startNewOperation} disabled={pending}>
        Iniciar outra entrega
      </button><p className="muted">Reenvie a mesma entrega sem iniciar outra operação. Para uma entrega nova, escolha “Iniciar outra entrega”.</p></div>}
    </fieldset>
  </form>;
}
