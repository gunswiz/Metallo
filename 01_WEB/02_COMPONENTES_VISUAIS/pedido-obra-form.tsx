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
  const [kind, setKind] = useState("material");
  const [item, setItem] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const typeLabel = (value: string) => value === "epi" ? "EPI" : "Material";
  const choices =
    kind === "material" ? data.materials : data.epi_items;
  const variants =
    kind === "epi"
      ? (data.epi_items.find((x) => x.id === item)?.variants ?? [])
      : [];
  if (!canPurchase) return null;
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
            if (lock.current) return;
            const form = event.currentTarget;
            const values = new FormData(form);
            const description = choices.find((x) => x.id === item)?.name;
            const variant = String(values.get("variant") ?? "").trim();
            const quantity = Number(values.get("quantity"));
            if (!description || !item || !Number.isInteger(quantity) || quantity < 1 || quantity > 100000 || (variants.length > 0 && !variants.includes(variant))) { setError("Escolha o item, a variante e uma quantidade inteira entre 1 e 100.000."); return; }
            const itemKey = item;
            const existing = lines.findIndex((line) => line.kind === kind && (line.item_id ?? line.epi_item_id ?? line.description) === itemKey && line.variant === variant);
            if (existing >= 0) {
              if (lines[existing].quantity + quantity > 100000) { setError("A quantidade total do item deve ser de até 100.000."); return; }
              setLines(lines.map((line, index) => index === existing ? { ...line, quantity: line.quantity + quantity } : line));
            } else {
              if (lines.length >= 100) { setError("Cada pedido pode ter até 100 itens."); return; }
              setLines([...lines, { kind, description, variant, quantity, ...(kind === "material" ? { item_id: item } : { epi_item_id: item }) }]);
            }
            setError("");
            form.reset();
            setItem("");
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
            </select>
          </label>
          {
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
          }
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
              <input key={`${kind}:${item}`} name="variant" maxLength={100} disabled={busy} />
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
          {canPurchase && canRent && <p className="muted full">Máquinas são registradas na área de locações quando a necessidade for decidida. Este pedido reúne materiais e EPI.</p>}
          <button
            className="button secondary"
            type="submit"
            disabled={busy}
          >
            Adicionar à lista
          </button>
        </form>
        <div className="order-draft">
          <div className="order-draft-header"><strong>Itens do pedido</strong><span>{lines.length} {lines.length === 1 ? "item" : "itens"}</span></div>
          {lines.length === 0 && <p className="muted">A lista está vazia. Adicione os materiais necessários acima; depois envie tudo de uma vez para a ADM.</p>}
          {lines.map((line, index) => (
            <div className="order-draft-row" key={index}>
              <span><b>{typeLabel(line.kind)}</b>
              {line.quantity} × {line.description}{" "}
              {line.variant && `(${line.variant})`}{" "}
              </span>
              <input aria-label={"Quantidade de " + line.description} type="number" min={1} max={100000} step={1} value={line.quantity} disabled={busy} onChange={(event) => { const quantity = Number(event.target.value); if (Number.isInteger(quantity) && quantity > 0 && quantity <= 100000) setLines(lines.map((entry, i) => i === index ? { ...entry, quantity } : entry)); }} />
              <button
                className="text-link"
                disabled={busy}
                onClick={() => setLines(lines.filter((_, i) => i !== index))}
              >
                Remover
              </button>
            </div>
          ))}
        </div>
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
