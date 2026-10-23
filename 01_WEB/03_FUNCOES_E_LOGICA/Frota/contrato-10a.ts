import { z } from "zod";

// Marco 10A: frota de caminhões munck (contratos de leitura e rótulos). Sem localização por GPS.
export const SITUACAO_FROTA_10A = ["disponivel", "em_uso", "nao_liberado", "manutencao"] as const;
export type SituacaoFrota10a = (typeof SITUACAO_FROTA_10A)[number];
export const ROTULO_SITUACAO_FROTA_10A: Record<SituacaoFrota10a, string> = { disponivel: "Disponível", em_uso: "Na rua", nao_liberado: "Não liberado", manutencao: "Na oficina" };
export const ROTULO_RESULTADO_10A = { liberado: "Liberado", ressalvas: "Liberado com ressalvas", nao_liberado: "Não liberado" } as const;
export const ROTULO_DOCUMENTO_10A = { crlv: "CRLV", seguro: "Seguro", inspecao_guindaste: "Inspeção do guindaste", outro: "Outro documento" } as const;
export const ROTULO_STATUS_MANUTENCAO_10A = { aberta: "Aberta", na_oficina: "Na oficina", concluida: "Concluída", cancelada: "Cancelada" } as const;

const situacao = z.enum(SITUACAO_FROTA_10A), resultado = z.enum(["liberado", "ressalvas", "nao_liberado"]);

export const caminhoesApp10a = z.array(z.object({ id: z.coerce.number(), nome: z.string(), placa: z.string(), modelo: z.string().nullable(), situacao,
  km_atual: z.coerce.number(), checklist_hoje: resultado.nullable(), motorista: z.string().nullable(), destino: z.string().nullable(),
  saida_em: z.string().nullable(), minha_viagem: z.coerce.number().nullable() }));
export const itensApp10a = z.array(z.object({ codigo: z.coerce.number(), nome: z.string(), critico: z.boolean() }));
export const viagensApp10a = z.array(z.object({ id: z.coerce.number(), veiculo: z.string(), destino: z.string(), saida_em: z.string(), chegada_em: z.string().nullable(),
  km_saida: z.coerce.number(), km_chegada: z.coerce.number().nullable() }));
export const resultadoChecklistApp10a = z.array(z.object({ id: z.coerce.number(), resultado }));
export type CaminhaoApp10a = z.infer<typeof caminhoesApp10a>[number];
export type ItemChecklist10a = z.infer<typeof itensApp10a>[number];
export type ViagemApp10a = z.infer<typeof viagensApp10a>[number];
export type RespostaChecklist10a = { codigo: number; situacao: "C" | "N" | "NA"; obs: string; foto?: string };

export const painelGestao10a = z.array(z.object({ id: z.coerce.number(), nome: z.string(), placa: z.string(), modelo: z.string().nullable(), ano: z.coerce.number().nullable(), situacao,
  km_atual: z.coerce.number(), ativo: z.boolean(), motorista: z.string().nullable(), destino: z.string().nullable(), acompanhantes: z.string().nullable(), saida_em: z.string().nullable(),
  checklist_hoje: resultado.nullable(), checklist_hoje_em: z.string().nullable(), checklist_hoje_por: z.string().nullable(),
  manutencoes_abertas: z.coerce.number(), docs_vencidos: z.coerce.number(), docs_breve: z.coerce.number(), planos_vencidos: z.coerce.number(), planos_breve: z.coerce.number() }));
export const atencaoGestao10a = z.array(z.object({ veiculo_id: z.coerce.number(), nome: z.string(), tipo: z.string(), texto: z.string(), gravidade: z.string() }));
export const itensGestao10a = z.array(z.object({ codigo: z.coerce.number(), nome: z.string(), critico: z.boolean(), ativo: z.boolean() }));
export const fichaGestao10a = z.object({
  veiculo: z.object({ id: z.coerce.number(), nome: z.string(), placa: z.string(), modelo: z.string().nullable(), ano: z.coerce.number().nullable(), situacao, km_atual: z.coerce.number(), ativo: z.boolean() }),
  documentos: z.array(z.object({ id: z.coerce.number(), tipo: z.enum(["crlv", "seguro", "inspecao_guindaste", "outro"]), descricao: z.string(), numero: z.string().nullable(), vencimento: z.string() })),
  planos: z.array(z.object({ id: z.coerce.number(), descricao: z.string(), cada_km: z.coerce.number().nullable(), cada_dias: z.coerce.number().nullable(), ultimo_km: z.coerce.number().nullable(),
    ultima_data: z.string().nullable(), ativo: z.boolean(), situacao: z.enum(["vencido", "breve", "ok"]) })),
  manutencoes: z.array(z.object({ id: z.coerce.number(), tipo: z.enum(["corretiva", "preventiva"]), descricao: z.string(), origem: z.string(), status: z.enum(["aberta", "na_oficina", "concluida", "cancelada"]),
    bloqueia: z.boolean(), aberta_em: z.string(), oficina: z.string().nullable(), enviada_em: z.string().nullable(), previsao: z.string().nullable(), concluida_em: z.string().nullable(),
    km: z.coerce.number().nullable(), custo: z.coerce.number().nullable(), obs: z.string().nullable() })),
  viagens: z.array(z.object({ id: z.coerce.number(), motorista: z.string(), destino: z.string(), acompanhantes: z.string().nullable(), saida_em: z.string(), km_saida: z.coerce.number(),
    chegada_em: z.string().nullable(), km_chegada: z.coerce.number().nullable() })),
  checklists: z.array(z.object({ id: z.coerce.number(), dia: z.string(), resultado, por: z.string(), local: z.string().nullable(), observacoes: z.string().nullable(), created_at: z.string(), itens_nao_conformes: z.coerce.number() })),
  eventos: z.array(z.object({ tipo: z.string(), texto: z.string(), em: z.string(), pessoa: z.string().nullable() })),
});
export const checklistDetalhe10a = z.object({
  checklist: z.object({ id: z.coerce.number(), veiculo: z.string(), placa: z.string(), dia: z.string(), resultado, por: z.string(), local: z.string().nullable(), observacoes: z.string().nullable(), created_at: z.string() }),
  itens: z.array(z.object({ codigo: z.coerce.number(), nome: z.string(), situacao: z.enum(["C", "N", "NA"]), obs: z.string().nullable(), critico: z.boolean(), foto: z.uuid().nullable().optional() })),
});
export const mesGestao10a = z.array(z.object({ dia: z.string(), codigo: z.coerce.number(), situacao: z.enum(["C", "N", "NA"]), por: z.string().nullable() }));
export const fotosChegadaGestao10b = z.array(z.object({ viagem_id: z.coerce.number(), foto_id: z.uuid() }));
export const relatosGestao10c = z.array(z.object({ manutencao_id: z.coerce.number(), relatos: z.array(z.object({ quando: z.string(), tipo: z.enum(["checklist", "chegada"]), por: z.string().nullable(),
  itens: z.array(z.object({ item: z.string(), obs: z.string().nullable().optional(), critico: z.boolean().optional(), foto: z.uuid().nullable().optional() })).optional(),
  problema: z.string().nullable().optional(), foto: z.uuid().nullable().optional() })).nullable() }));
export type RelatosGestao10c = z.infer<typeof relatosGestao10c>;
export type PainelGestao10a = z.infer<typeof painelGestao10a>[number];
export type FichaGestao10a = z.infer<typeof fichaGestao10a>;

const idNum = z.coerce.number().int().positive();
const texto = (max: number) => z.string().trim().max(max).refine(v => !/[\u0000-\u0008\u000b-\u001f]/.test(v));
const numOpc = z.union([z.literal(""), z.coerce.number().int().min(0).max(3000000)]);
const dataOpc = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]);

export const caminhaoForm10a = z.object({ id: z.union([z.literal(""), idNum]).optional(), placa: z.string().trim().transform(v => v.toUpperCase().replace(/[^A-Z0-9]/g, "")).pipe(z.string().regex(/^[A-Z0-9]{7}$/)),
  nome: texto(60).pipe(z.string().min(2)), modelo: texto(60), ano: z.union([z.literal(""), z.coerce.number().int().min(1980).max(2100)]), km: z.coerce.number().int().min(0).max(3000000), ativo: z.string().optional() });
export const documentoForm10a = z.object({ veiculoId: idNum, tipo: z.enum(["crlv", "seguro", "inspecao_guindaste", "outro"]), descricao: texto(60), numero: texto(60), vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
export const itemForm10a = z.object({ codigo: z.union([z.literal(""), z.coerce.number().int().min(1).max(99)]), nome: texto(80).pipe(z.string().min(2)), critico: z.string().optional(), ativo: z.string().optional() });
export const liberarForm10a = z.object({ veiculoId: idNum, motivo: texto(300).pipe(z.string().min(5)) });
export const abrirManutencaoForm10a = z.object({ veiculoId: idNum, tipo: z.enum(["corretiva", "preventiva"]), descricao: texto(300).pipe(z.string().min(3)), bloquear: z.string().optional() });
export const oficinaForm10a = z.object({ veiculoId: idNum, manutencaoId: idNum, oficina: texto(80).pipe(z.string().min(2)), previsao: dataOpc });
export const concluirManutencaoForm10a = z.object({ veiculoId: idNum, manutencaoId: idNum, custo: z.union([z.literal(""), z.string().regex(/^\d{1,8}([.,]\d{1,2})?$/)]), km: numOpc, obs: texto(300) });
export const cancelarManutencaoForm10a = z.object({ veiculoId: idNum, manutencaoId: idNum, motivo: texto(300).pipe(z.string().min(3)) });
export const planoForm10a = z.object({ veiculoId: idNum, id: z.union([z.literal(""), idNum]).optional(), descricao: texto(80).pipe(z.string().min(2)), cadaKm: numOpc, cadaDias: z.union([z.literal(""), z.coerce.number().int().min(1).max(3650)]),
  ultimoKm: numOpc, ultimaData: dataOpc, ativo: z.string().optional() });
export const concluirPlanoForm10a = z.object({ veiculoId: idNum, planoId: idNum, km: numOpc, data: dataOpc, custo: z.union([z.literal(""), z.string().regex(/^\d{1,8}([.,]\d{1,2})?$/)]), obs: texto(300) });

export const MENSAGEM_ERRO_FROTA_10A: Record<string, string> = {
  checklist_do_dia_necessario: "Faça o checklist de hoje antes de sair.", veiculo_nao_liberado: "Este caminhão não está liberado. Fale com o engenheiro.",
  veiculo_em_uso: "Este caminhão já está na rua.", veiculo_em_manutencao: "Este caminhão está na oficina.", voce_ja_esta_com_um_caminhao: "Você já está com um caminhão. Registre a chegada primeiro.",
  km_menor_que_atual: "O km não pode ser menor que o do caminhão.", km_menor_que_saida: "O km de chegada não pode ser menor que o da saída.",
  descreva_o_problema: "Descreva o problema com pelo menos 3 letras.", itens_incompletos: "Responda todos os itens do checklist.", ciencia_obrigatoria: "Marque que você está ciente.",
  foto_invalida: "A foto não pôde ser usada. Tire de novo.", tipo_arquivo: "Esse arquivo não é uma foto. Tire a foto de novo.", arquivo_grande: "Foto grande demais. Tire de novo.",
  muitos_envios: "Muitas fotos hoje. Fale com o engenheiro.", sem_arquivo: "Tire a foto antes de enviar.",
  destino_invalido: "Informe o destino.", veiculo_indisponivel: "Este caminhão não pode receber checklist agora.",
};
export function mensagemErroFrota10a(erro: unknown) {
  const m = String(erro instanceof Error ? erro.message : erro);
  for (const [chave, texto] of Object.entries(MENSAGEM_ERRO_FROTA_10A)) if (m.includes(chave)) return texto;
  return "Não foi possível concluir. Tente de novo.";
}
/** "350,5" → 350.5; vazio → null. */
export function lerCusto10a(v: string) { return v === "" ? null : Number(v.replace(",", ".")); }
