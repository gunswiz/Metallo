"use client";
import { useState, useRef } from "react";
import {
  localEventTime,
  type SiteSnapshot,
} from "@/03_FUNCOES_E_LOGICA/operacoesObra";
import type { SubmitOperation } from "./formulario-obra";
type Line = {
  kind: string;
  item_id?: string;
  epi_item_id?: string;
  description: string;
  variant: string;
  quantity: number;
};
export function SiteOrderForm({
  data,
  teams,
  submit,
  canPurchase,
  canRent,
}: {
  data: SiteSnapshot;
  teams: SiteSnapshot["teams"];
  submit: SubmitOperation;
  canPurchase: boolean;
  canRent: boolean;
}) {
  const [kind, setKind] = useState(canPurchase ? "material" : "rental");
  const [item, setItem] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const choices =
    kind === "material" ? data.materials : kind === "epi" ? data.epi_items : [];
  const variants =
    kind === "epi"
      ? (data.epi_items.find((x) => x.id === item)?.variants ?? [])
      : [];
  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Novo pedido à ADM</h2>
      </header>
      <div className="panel-body">
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const values = new FormData(form);
            const description =
              kind === "rental"
                ? String(values.get("description") ?? "").trim()
                : choices.find((x) => x.id === item)?.name;
            if (!description || lines.length >= 100) return;
            setLines([
              ...lines,
              {
                kind,
                description,
                variant: String(values.get("variant") ?? ""),
                quantity: Number(values.get("quantity")),
                ...(kind === "material"
                  ? { item_id: item }
                  : kind === "epi"
                    ? { epi_item_id: item }
                    : {}),
              },
            ]);
          }}
        >
          <label>
            Tipo
            <select
              value={kind}
              disabled={busy}
              onChange={(e) => {
                setKind(e.target.value);
                setItem("");
              }}
            >
              {canPurchase && (
                <>
                  <option value="material">Material</option>
                  <option value="epi">EPI / fardamento / item pessoal</option>
                </>
              )}
              {canRent && <option value="rental">Máquina alugada</option>}
            </select>
          </label>
          {kind === "rental" ? (
            <label>
              Máquina necessária
              <input
                name="description"
                required
                maxLength={180}
                disabled={busy}
              />
            </label>
          ) : (
            <label>
              Item
              <select
                value={item}
                required
                disabled={busy}
                onChange={(e) => setItem(e.target.value)}
              >
                <option value="">Selecione</option>
                {choices.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {variants.length > 0 ? (
            <label>
              Variante
              <select key={item} name="variant" required disabled={busy}>
                <option value="">Selecione</option>
                {variants.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              Tamanho / variante
              <input name="variant" maxLength={100} disabled={busy} />
            </label>
          )}
          <label>
            Quantidade
            <input
              name="quantity"
              type="number"
              min={1}
              max={100000}
              defaultValue={1}
              required
              disabled={busy}
            />
          </label>
          <button
            className="button secondary"
            type="submit"
            disabled={busy || lines.length >= 100}
          >
            Adicionar à lista
          </button>
        </form>
        <ul className="order-draft">
          {lines.map((line, index) => (
            <li key={index}>
              {line.quantity} × {line.description}{" "}
              {line.variant && `(${line.variant})`}{" "}
              <button
                className="text-link"
                disabled={busy}
                onClick={() => setLines(lines.filter((_, i) => i !== index))}
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
        <form
          className="form-grid"
          onSubmit={async (event) => {
            event.preventDefault();
            if (lock.current || !lines.length) return;
            const form = event.currentTarget;
            const values = new FormData(form);
            lock.current = true;
            setBusy(true);
            setError("");
            try {
              await submit(
                "create_order",
                {
                  team_id: String(values.get("team_id")),
                  note: String(values.get("note") ?? ""),
                  lines,
                },
                String(values.get("eventTime")),
              );
              setLines([]);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Confira o pedido.");
            } finally {
              lock.current = false;
              setBusy(false);
            }
          }}
        >
          <label>
            Equipe solicitante
            <select name="team_id" required disabled={busy}>
              <option value="">Selecione</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Quando foi solicitado? (Fortaleza)
            <input
              type="datetime-local"
              name="eventTime"
              defaultValue={localEventTime()}
              required
              disabled={busy}
            />
          </label>
          <label className="full">
            Observação
            <textarea name="note" maxLength={500} disabled={busy} />
          </label>
          {error && <p className="alert error full">{error}</p>}
          <button
            type="submit"
            className="button primary"
            disabled={busy || !lines.length}
          >
            {busy ? "Salvando…" : "Enviar pedido à ADM"}
          </button>
        </form>
      </div>
    </section>
  );
}
