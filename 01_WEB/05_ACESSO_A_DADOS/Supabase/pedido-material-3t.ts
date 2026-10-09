import { z } from "zod";
import { createClient } from "./server";

// Marco 3T: pedidos de material feitos pelo app (Gestão). Só laboratório e teste online.
const pedidos = z.array(z.object({ id: z.coerce.number(), funcionario: z.string(), matricula: z.string().nullable(), material: z.string(), unidade: z.string(),
  quantidade: z.coerce.number(), observacao: z.string().nullable(), status: z.enum(["aberto", "atendido", "recusado", "cancelado"]),
  resposta: z.string().nullable(), created_at: z.string(), decided_at: z.string().nullable() }));
export type PedidoMaterial3t = z.infer<typeof pedidos>[number];

export async function lerPedidosMaterial3t() {
  const r = await (await createClient()).rpc("admin_pedidos_material_3t" as never);
  if (r.error) return null;
  return pedidos.parse(r.data);
}
