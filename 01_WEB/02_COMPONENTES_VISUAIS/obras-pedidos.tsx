"use client";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Json, SessionProfile } from "@metallo/types";
import { can, formatDateTime } from "@metallo/core";
import { createClient } from "@/05_ACESSO_A_DADOS/Supabase/client";
import {
  eventTime,
  operationErrorMessage,
  siteSnapshotSchema,
  type SiteSnapshot,
} from "@/03_FUNCOES_E_LOGICA/operacoesObra";
import type { SubmitOperation } from "./formulario-obra";

import { createOperationQueue } from "@/03_FUNCOES_E_LOGICA/fila-operacoes";

import { EstoqueObra } from "./ObrasEPedidos/estoque";
import { PedidosObra } from "./ObrasEPedidos/pedidos";
import { LocacoesObra } from "./ObrasEPedidos/locacoes";
import { FuncionariosObra } from "./ObrasEPedidos/funcionarios";
import { CadastroObras } from "./ObrasEPedidos/cadastro";

const commandLabels: Record<string, string> = {
  epi_entry: "Entrada de EPI",
  epi_transfer: "Transferência de EPI",
  set_worksite_status: "Situação da obra",
  create_order: "Pedido à ADM",
  receive_order: "Recebimento",
  consume: "Consumo",
  material_entry: "Entrada direta",
  transfer_equipment: "Transferência de equipamento",
  deliver_epi: "Entrega de EPI",
  create_worksite: "Cadastro de obra",
  link_team: "Vínculo de equipe",
  assign_employee: "Alocação de funcionário",
  end_assignment: "Fim da alocação",
  rental_notify: "Aviso de devolução",
  rental_resolve: "Tratamento da devolução",
  order_status: "Etapa do pedido",
  rental_details: "Dados da locação",
};
export function SiteOperations({
  initial,
  profile,
  initialSection = "stock",
}: {
  initial: SiteSnapshot;
  profile: SessionProfile;
  initialSection?: string;
}) {
  const [data, setData] = useState(initial);
  const [section, setSection] = useState(initialSection);
  const [message, setMessage] = useState("");
  const queue = useMemo(() => createOperationQueue(profile.id), [profile.id]);
  const queueState = useSyncExternalStore(
    queue.subscribe,
    queue.read,
    queue.serverSnapshot,
  );
  const pending = queueState.entries;
  const processing = useRef(false);
  const [syncing, setSyncing] = useState(false);
  const admin = profile.role === "admin";
  const refresh = async () => {
    const result = await createClient().rpc("site_dashboard");
    if (result.error) throw result.error;
    setData(siteSnapshotSchema.parse(result.data));
  };
  const sync = async () => {
    if (processing.current) return;
    processing.current = true;
    setSyncing(true);
    try {
      for (const entry of [...queue.read().entries]) {
        if (!navigator.onLine) {
          setMessage(
            "Sem conexão. Os lançamentos estão guardados neste navegador e ainda não alteraram o estoque.",
          );
          break;
        }
        try {
          const client = createClient();
          const { data: auth } = await client.auth.getUser();
          if (auth.user?.id !== profile.id)
            throw Error(
              "Entre novamente na mesma conta para enviar os lançamentos.",
            );
          const result = await client.rpc("run_site_operation", {
            p_command: entry.command,
            p_data: entry.data as Json,
            p_operation_id: entry.id,
            p_occurred_at: entry.occurredAt,
          });
          if (result.error) throw result.error;
          await queue.update((rows) => rows.filter((x) => x.id !== entry.id));
          setMessage("Lançamento confirmado no Metallo.");
        } catch (error) {
          const detail = operationErrorMessage(
            error instanceof Error
              ? error.message
              : String((error as { message?: string })?.message ?? error),
          );
          await queue.update((rows) =>
            rows.map((x) => (x.id === entry.id ? { ...x, error: detail } : x)),
          );
          setMessage(detail);
          break;
        }
      }
      try {
        await refresh();
      } catch {
        setMessage(
          "Não foi possível atualizar a consulta. Confira os lançamentos pendentes abaixo antes de reenviar qualquer registro.",
        );
      }
    } finally {
      processing.current = false;
      setSyncing(false);
    }
  };
  const submit: SubmitOperation = async (command, payload, time) => {
    const occurredAt = eventTime(time);
    if (queue.read().entries.length >= 200)
      throw Error(
        "Envie ou confira os lançamentos pendentes antes de adicionar outros.",
      );
    await queue.update((rows) => [
      ...rows,
      {
        id: crypto.randomUUID(),
        command,
        data: { ...payload, actor_id: profile.id },
        occurredAt,
      },
    ]);
    await sync();
  };
  const navigation = [
    ["stock", "Estoque e lançamentos"],
    ["orders", "Pedidos e recebimentos"],
    ["rentals", "Máquinas alugadas"],
    ...(can(profile, "epi:read") ? [["people", "Funcionários em apoio"]] : []),
    ...(admin
      ? [
          ["works", "Obras e equipes"],
          ["alerts", `Alertas (${data.alerts.length})`],
        ]
      : []),
  ];
  return (
    <>
      <div className="module-tabs">
        {navigation.map(([id, label]) => (
          <button
            key={id}
            className={section === id ? "button primary" : "button ghost"}
            onClick={() => setSection(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="muted">
        Uma obra pode reunir várias equipes com um estoque único. Os lançamentos
        continuam identificando a equipe e o funcionário.
      </p>
      {queueState.error && (
        <p className="alert error" role="alert">
          {queueState.error}
        </p>
      )}
      {message && (
        <p className="alert" role="status">
          {message}
        </p>
      )}
      <button
        className="button secondary"
        disabled={syncing}
        onClick={() => void sync()}
      >
        {syncing ? "Enviando…" : "Atualizar e enviar pendentes"}
      </button>
      {pending.length > 0 && (
        <section className="panel pending-panel">
          <header className="panel-header">
            <h2>{pending.length} lançamento(s) aguardando confirmação</h2>
          </header>
          <div className="panel-body">
            <p>
              Guardados neste navegador. Não apague os dados do navegador antes
              de enviar.
            </p>
            {pending.map((entry) => (
              <div className="pending-operation" key={entry.id}>
                <strong>
                  {commandLabels[entry.command] ?? "Lançamento"} ·{" "}
                  {formatDateTime(entry.occurredAt)}
                </strong>
                {entry.error && <p>{entry.error}</p>}
                <button
                  disabled={syncing}
                  className="button ghost"
                  onClick={async () => {
                    try {
                      await queue.update((rows) =>
                        rows.filter((x) => x.id !== entry.id),
                      );
                      setMessage(
                        "Lançamento retirado da fila local. Confira o histórico se uma tentativa anterior ficou sem resposta.",
                      );
                    } catch {
                      setMessage(
                        "Não foi possível alterar a fila local. Tente novamente.",
                      );
                    }
                  }}
                >
                  Retirar da fila local
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
      {section === "stock" && (
        <EstoqueObra data={data} profile={profile} submit={submit} />
      )}
      {section === "orders" && (
        <PedidosObra data={data} profile={profile} submit={submit} />
      )}
      {section === "rentals" && (
        <LocacoesObra data={data} profile={profile} submit={submit} />
      )}
      {section === "people" && (
        <FuncionariosObra data={data} profile={profile} submit={submit} />
      )}
      {section === "works" && admin && (
        <CadastroObras data={data} profile={profile} submit={submit} />
      )}
      {section === "alerts" && admin && (
        <section className="panel">
          <header className="panel-header">
            <h2>Alertas da ADM</h2>
          </header>
          <div className="panel-body">
            {!data.alerts.length && <p>Nenhuma pendência identificada.</p>}
            {data.alerts.map((a) => (
              <button
                className="alert-card"
                key={a.id}
                onClick={() => setSection(a.section)}
              >
                <strong>{a.title}</strong>
                <span>{a.description}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
