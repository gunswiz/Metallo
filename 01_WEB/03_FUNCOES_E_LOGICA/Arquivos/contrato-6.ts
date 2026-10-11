import { z } from "zod";

// Marcos 6A/6B: o que o app do funcionário recebe do banco (contracheques e atestados).
export const contrachequeApp6a = z.object({ id: z.coerce.number().int(), arquivo_id: z.uuid(), competencia: z.string().regex(/^20\d{2}-\d{2}$/),
  tipo_folha: z.enum(["mensal", "adiantamento", "ferias", "decimo_terceiro"]), publicado_em: z.string(), visto_em: z.string().nullable() });
export type ContrachequeApp6a = z.infer<typeof contrachequeApp6a>;
export const atestadoApp6b = z.object({ id: z.coerce.number().int(), arquivo_id: z.uuid(), data_inicio: z.string().regex(/^20\d{2}-\d{2}-\d{2}$/),
  dias: z.number().int().min(1).max(30), status: z.enum(["enviado", "aceito", "recusado", "cancelado"]), enviado_em: z.string(),
  decidido_em: z.string().nullable(), motivo_recusa: z.string().nullable() });
export type AtestadoApp6b = z.infer<typeof atestadoApp6b>;
export const NOME_FOLHA: Record<ContrachequeApp6a["tipo_folha"], string> = { mensal: "Mensal", adiantamento: "Adiantamento", ferias: "Férias", decimo_terceiro: "13º salário" };
export const MENSAGEM_ENVIO_6: Record<string, string> = {
  tipo_arquivo: "Esse arquivo não é foto nem PDF. Tire uma foto do atestado.", arquivo_grande: "Arquivo grande demais. Tire a foto de novo.",
  data_invalida: "Confira a data: o atestado precisa ser dos últimos 60 dias.", dias_invalidos: "Confira quantos dias (de 1 a 30).",
  muitos_envios: "Muitos envios seguidos. Espere um pouco e tente de novo.", sem_arquivo: "Tire a foto do atestado antes de enviar.",
};

/**
 * Reduz a foto antes de enviar (celular antigo e internet fraca): no máximo 1600 px no lado maior, JPEG 82%.
 * PDF e arquivos pequenos vão como estão.
 */
export async function prepararFoto(arquivo: File): Promise<Blob> {
  if (!arquivo.type.startsWith("image/") || (arquivo.size < 400 * 1024 && arquivo.type === "image/jpeg")) return arquivo;
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = url; });
    const escala = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * escala)); canvas.height = Math.max(1, Math.round(img.naturalHeight * escala));
    const ctx = canvas.getContext("2d");
    if (!ctx) return arquivo;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(ok => canvas.toBlob(ok, "image/jpeg", 0.82));
    return blob && blob.size > 0 ? blob : arquivo;
  } catch { return arquivo; }
  finally { URL.revokeObjectURL(url); }
}
