import { z } from "zod";

export const ETAPAS_MODELO_10G = ["Cabine", "Segurança", "Rodagem", "Carroceria", "Hidráulica", "Estabilizadores", "Içamento"] as const;
const texto = (min: number, max: number) => z.string().trim().min(min).max(max).refine(v => !/[\u0000-\u001f]/.test(v), "Use texto sem caracteres de controle.");
export const itemModelo10g = z.object({ codigo: z.number().int().min(1).max(99), nome: texto(2, 80), etapa: z.enum(ETAPAS_MODELO_10G), critico: z.boolean(), permite_na: z.boolean(), exige_foto: z.boolean() });
export const itensModelo10g = z.array(itemModelo10g).min(1, "Inclua ao menos uma pergunta.").max(60).refine(itens => new Set(itens.map(i => i.codigo)).size === itens.length, "Há códigos de perguntas repetidos.");
export type ItemModelo10g = z.infer<typeof itemModelo10g>;
export const categoriaModelo10g = z.string().regex(/^[a-z][a-z0-9_]{1,29}$/, "Use de 2 a 30 letras minúsculas, números ou sublinhado no código.");
export const modeloForm10g = z.object({ categoria: categoriaModelo10g, nome: texto(2, 60), base: z.coerce.number().int().min(0), motivo: texto(5, 300), idempotencyKey: z.uuid(),
  itens: z.string().max(24000).transform((value, ctx) => { try { return JSON.parse(value) as unknown; } catch { ctx.addIssue({ code: "custom", message: "Não foi possível ler as perguntas. Atualize a página." }); return z.NEVER; } }).pipe(itensModelo10g),
});
export const modelosGestao10g = z.object({ atual: z.number().int(),
  categorias: z.array(z.object({ codigo: categoriaModelo10g, nome: z.string() })),
  modelo: z.object({ categoria: categoriaModelo10g, nome: z.string(), revisao: z.number().int(), itens: itensModelo10g, motivo: z.string(), em: z.string(), autor: z.string() }),
  historico: z.array(z.object({ revisao: z.number().int(), em: z.string(), motivo: z.string() })),
});
