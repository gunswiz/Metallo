import { createHash } from "node:crypto";
import { z } from "zod";

const uuid = z.uuid();
const snapshotItem = z.object({
  delivery_id: uuid, item_name: z.string().min(1), item_code: z.string().nullable(),
  ca: z.string().nullable(), quantity: z.number().int().positive(), unit: z.string().min(1),
  size: z.string().nullable(), lot: z.string().nullable(), brand: z.string().nullable(),
}).strict();
export const deliverySnapshotSchema = z.object({
  employee_id: uuid, group_id: uuid, delivered_at: z.iso.datetime({ offset: true }),
  items: z.array(snapshotItem).min(1).max(30),
}).strict();
export type DeliverySnapshot3f = z.infer<typeof deliverySnapshotSchema>;

// Ordem explícita, tipos validados, UTF-8, UTC ISO, null literal, inteiros decimais e arrays por UUID.
// Alterar este formato exige nova versão; JSON.stringify recebe objeto construído nesta ordem.
export function canonicalDelivery3f(source: unknown, transactionId: string) {
  const data = deliverySnapshotSchema.parse(source);
  const id = uuid.parse(transactionId);
  const items = [...data.items].sort((a, b) => a.delivery_id.localeCompare(b.delivery_id));
  if (new Set(items.map(item => item.delivery_id)).size !== items.length) throw new Error("Itens duplicados.");
  const payload = {
    version: "3F-v1", transaction_id: id, employee_id: data.employee_id,
    group_id: data.group_id, delivered_at: new Date(data.delivered_at).toISOString(),
    items: items.map(item => ({
      delivery_id: item.delivery_id, item_name: item.item_name, item_code: item.item_code,
      ca: item.ca, quantity: item.quantity, unit: item.unit, size: item.size,
      lot: item.lot, brand: item.brand,
    })),
  };
  const canonical = JSON.stringify(payload);
  const hash = createHash("sha256").update(canonical, "utf8").digest("hex");
  return { payload, canonical, hash };
}
