import { z } from "zod";

// Marco 3T: pedido de material pelo app (contratos de leitura).
export const materiais3t = z.array(z.object({ item_id: z.string().uuid(), nome: z.string(), unidade: z.string(), categoria: z.string().nullable() }));
export const meusPedidos3t = z.array(z.object({ id: z.coerce.number(), material: z.string(), unidade: z.string(), quantidade: z.coerce.number(),
  observacao: z.string().nullable(), status: z.enum(["aberto", "atendido", "recusado", "cancelado"]), resposta: z.string().nullable(),
  created_at: z.string(), decided_at: z.string().nullable() }));
export type Material3t = z.infer<typeof materiais3t>[number];
export type MeuPedido3t = z.infer<typeof meusPedidos3t>[number];
export const STATUS_PEDIDO_3T: Record<MeuPedido3t["status"], string> = { aberto: "Esperando resposta", atendido: "Atendido", recusado: "Recusado", cancelado: "Cancelado" };

/** "2,5" → 2.5; aceita até 2 casas; 0 ou mais de 1000 → null. */
export function lerQuantidade3t(texto: string) {
  const limpo = texto.trim().replace(",", ".");
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(limpo)) return null;
  const n = Number(limpo);
  return n > 0 && n <= 1000 ? n : null;
}
