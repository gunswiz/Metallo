"use client";
import { useRef, useState } from "react";
import { localEventTime } from "@/03_FUNCOES_E_LOGICA/operacoesObra";

export type OperationField = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "textarea" | "select";
  options?: Array<{ id: string; name: string }>;
  required?: boolean;
  value?: string;
  max?: number;
};
export type SubmitOperation = (
  command: string,
  data: Record<string, unknown>,
  time: string,
) => Promise<void>;
export function SiteOperationForm({
  command,
  title,
  fields,
  fixed = {},
  submit,
  label = "Registrar",
  children,
}: {
  command: string;
  title: string;
  fields: OperationField[];
  fixed?: Record<string, unknown>;
  submit: SubmitOperation;
  label?: string;
  children?: React.ReactNode;
}) {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <details className="operation-details">
      <summary>{title}</summary>
      <form
        className="form-grid"
        onSubmit={async (event) => {
          event.preventDefault();
          if (lock.current) return;
          const form = event.currentTarget;
          const data = new FormData(form);
          const payload: Record<string, unknown> = { ...fixed };
          for (const field of fields)
            payload[field.name] =
              field.type === "number" && data.get(field.name) !== ""
                ? Number(data.get(field.name))
                : String(data.get(field.name) ?? "").trim();
          if (payload.asset_codes !== undefined)
            payload.asset_codes = String(payload.asset_codes)
              .split(/[\n,;]+/)
              .map((x) => x.trim())
              .filter(Boolean);
          if (payload.ends_at)
            payload.ends_at = `${payload.ends_at}T23:59:59-03:00`;
          if (payload.delivery_batch) {
            const [stock_batch_id, item_id] = String(
              payload.delivery_batch,
            ).split("|");
            payload.lines = [
              { stock_batch_id, item_id, quantity: payload.quantity },
            ];
            delete payload.delivery_batch;
            delete payload.quantity;
          }
          lock.current = true;
          setBusy(true);
          setError("");
          try {
            await submit(command, payload, String(data.get("eventTime")));
            form.reset();
          } catch (cause) {
            setError(
              cause instanceof Error ? cause.message : "Confira os campos.",
            );
          } finally {
            lock.current = false;
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy} className="form-grid full">
          {fields.map((field) => (
            <label
              key={field.name}
              className={field.type === "textarea" ? "full" : undefined}
            >
              {field.label}
              {field.type === "select" ? (
                <select
                  name={field.name}
                  required={field.required !== false}
                  defaultValue={field.value ?? ""}
                >
                  <option value="">Selecione</option>
                  {field.options?.map((option) => (
                    <option value={option.id} key={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              ) : field.type === "textarea" ? (
                <textarea
                  name={field.name}
                  defaultValue={field.value}
                  maxLength={500}
                  required={field.required === true}
                />
              ) : (
                <input
                  name={field.name}
                  type={field.type ?? "text"}
                  required={field.required !== false}
                  defaultValue={field.value}
                  min={field.type === "number" ? 0 : undefined}
                  max={field.max}
                  step={field.name === "amount" ? "0.01" : undefined}
                  maxLength={180}
                />
              )}
            </label>
          ))}
          <label>
            Quando aconteceu? (Fortaleza)
            <input
              name="eventTime"
              type="datetime-local"
              required
              defaultValue={localEventTime()}
            />
          </label>
          <p className="muted full">
            Se estiver lançando depois, ajuste a data e a hora. O Metallo guarda
            também quando o lançamento foi enviado.
          </p>
          {children}
          {error && (
            <p className="alert error full" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button className="button primary" type="submit">
              {busy ? "Salvando…" : label}
            </button>
          </div>
        </fieldset>
      </form>
    </details>
  );
}
