import { z } from "zod";
import { createClient } from "./server";

// Marco 3T: pedidos de material feitos pelo app (Gestão). Só laboratório e teste online.
// Marco 5B: junto vem a equipe do funcionário, o saldo na obra dela e se o atendimento já deu baixa no estoque.
const pedidos = z.array(z.object({ id: z.coerce.number(), funcionario: z.string(), matricula: z.string().nullable(), material: z.string(), unidade: z.string(),
  quantidade: z.coerce.number(), observacao: z.string().nullable(), status: z.enum(["aberto", "atendido", "recusado", "cancelado"]),
  resposta: z.string().nullable(), created_at: z.string(), decided_at: z.string().nullable(),
  equipe: z.string().nullable().optional(), saldo_obra: z.coerce.number().nullable().optional(), baixa_feita: z.boolean().optional() }));
export type PedidoMaterial3t = z.infer<typeof pedidos>[number];

export async function lerPedidosMaterial3t() {
  const client = await createClient();
  const r = await client.rpc("admin_pedidos_material_5b" as never);
  if (!r.error) return pedidos.parse(r.data);
  const antigo = await client.rpc("admin_pedidos_material_3t" as never);
  return antigo.error ? null : pedidos.parse(antigo.data);
}
