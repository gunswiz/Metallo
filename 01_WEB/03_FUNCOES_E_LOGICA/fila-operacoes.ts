import { z } from "zod";
import type { PendingOperation } from "./operacoesObra";

const queueSchema = z
  .array(
    z.object({
      id: z.uuid(),
      command: z.string().min(1),
      data: z.record(z.string(), z.unknown()),
      occurredAt: z.iso.datetime(),
      error: z.string().optional(),
    }),
  )
  .max(200);
type QueueState = { entries: PendingOperation[]; error: string | null };
const empty: QueueState = { entries: [], error: null };

/** One account per queue. Web Locks serialize writes across browser tabs. */
export function createOperationQueue(userId: string) {
  const key = `metallo-operations-v1-${userId}`;
  let raw: string | null | undefined;
  let state = empty;
  const listeners = new Set<() => void>();
  function read(): QueueState {
    try {
      const next = localStorage.getItem(key);
      if (next !== raw || state.error) {
        const entries = queueSchema.parse(JSON.parse(next ?? "[]"));
        if (entries.some((entry) => entry.data.actor_id !== userId))
          throw Error("wrong_account");
        raw = next;
        state = { entries, error: null };
      }
    } catch {
      if (!state.error)
        state = {
          entries: [],
          error:
            "Não foi possível ler os lançamentos locais. Preserve os dados deste navegador e contate a ADM.",
        };
    }
    return state;
  }
  async function update(
    change: (entries: PendingOperation[]) => PendingOperation[],
  ) {
    if (!navigator.locks)
      throw Error(
        "Este navegador não permite guardar lançamentos com segurança. Use uma versão atual do Chrome, Edge ou Firefox.",
      );
    await navigator.locks.request(key, () => {
      const current = read();
      if (current.error) throw Error(current.error);
      const next = queueSchema.parse(change(current.entries));
      localStorage.setItem(key, JSON.stringify(next));
      read();
      listeners.forEach((listener) => listener());
    });
  }
  return {
    read,
    update,
    serverSnapshot: () => empty,
    subscribe(listener: () => void) {
      listeners.add(listener);
      const onStorage = (event: StorageEvent) => {
        if (event.key === key) listener();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
  };
}
