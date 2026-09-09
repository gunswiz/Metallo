"use client";

import { startTransition, useActionState } from "react";
import type { OperationState } from "@/03_FUNCOES_E_LOGICA/executarOperacaoValidada";
export type OperationAction = (previous: OperationState, formData: FormData) => Promise<OperationState>;

export function OperationForm({ action, children, label, pendingLabel = "Salvando…" }: {
  action: OperationAction; children: React.ReactNode; label: string; pendingLabel?: string;
}) {
  const [state, submit, pending] = useActionState(action, {});
  // Dispatch explicitly so validation failures do not reset the entered fields.
  // The action still supplies the POST fallback before hydration.
  return <form action={submit} onSubmit={(event) => {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    startTransition(() => submit(data));
  }}>
    {state.error && <div className="alert error" role="alert">{state.error}</div>}
    <fieldset disabled={pending} className="operation-fields form-grid">
      {children}
      <div className="form-actions"><button className="button primary" type="submit" disabled={pending}>{pending ? pendingLabel : label}</button></div>
    </fieldset>
  </form>;
}
