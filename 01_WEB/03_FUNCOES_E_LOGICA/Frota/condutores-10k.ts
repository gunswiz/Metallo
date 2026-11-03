import { z } from "zod";

export const categoriasCnh10k = ["A", "B", "C", "D", "E", "AB", "AC", "AD", "AE"] as const;
const validade = z.iso.date().refine(v => v >= "1900-01-01" && v <= "2200-12-31", "Informe uma data válida.");
export const cnhForm10k = z.object({
  employeeId: z.uuid(), base: z.coerce.number().int().min(0),
  categoria: z.enum(categoriasCnh10k), validade,
  situacao: z.enum(["informado", "conferido", "invalidado"]),
  referencia: z.string().trim().min(3).max(160), motivo: z.string().trim().min(10).max(600),
  idempotencyKey: z.uuid(),
});
export const condutoresGestao10k = z.object({
  hoje: z.iso.date(),
  funcionarios: z.array(z.object({ id: z.uuid(), nome: z.string(), ativo: z.boolean() })),
  historico: z.array(z.object({ id: z.number(), revisao: z.number(), categoria: z.enum(categoriasCnh10k), validade,
    situacao: z.enum(["informado", "conferido", "invalidado"]), referencia: z.string(), motivo: z.string(), em: z.string(), autor: z.string() })),
});
