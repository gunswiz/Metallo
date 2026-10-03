import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { zipSync } from "fflate";
import { personalRecord, type PersonalRecord } from "@/05_ACESSO_A_DADOS/Ponto/registros";
import { pointDate, pointTime } from "@/03_FUNCOES_E_LOGICA/Ponto/relogio-referencia";

export const POINT_RECEIPT_VERSION = "4B-LAB-v1";
export function pointReceiptFilename(record: PersonalRecord) {
  const event = personalRecord.parse(record);
  return `recibo-laboratorio-${event.event_id}.pdf`;
}
// Conteúdo determinístico não assinado. Um futuro assinador autorizado receberá estes bytes.
// Não existem chave, certificado, campos /Sig ou status de assinatura nesta etapa.
export async function buildPointReceipt(record: PersonalRecord, logoBytes?: Uint8Array) {
  const event = personalRecord.parse(record);
  const pdf = await PDFDocument.create();
  pdf.setTitle("Recibo de marcação - laboratório"); pdf.setAuthor("Metallo - laboratório");
  pdf.setCreator(POINT_RECEIPT_VERSION); pdf.setProducer(POINT_RECEIPT_VERSION);
  pdf.setCreationDate(new Date(event.recorded_at)); pdf.setModificationDate(new Date(event.recorded_at));
  const regular = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595.28, 841.89]);
  const brand = rgb(.04,.29,.48), ink = rgb(.12,.16,.2), soft = rgb(.34,.39,.44);
  const draw = (text: string, y: number, size = 12, strong = false, color = ink) => page.drawText(text, { x: 42, y, size, font: strong ? bold : regular, color });
  page.drawRectangle({ x: 0, y: 826, width: 595.28, height: 16, color: brand });
  if (logoBytes) { const logo = await pdf.embedPng(new Uint8Array(logoBytes)); page.drawImage(logo, { x: 42, y: 761, width: 122, height: 47 }); }
  else draw("METALLO", 786, 19, true, brand);
  draw("RECIBO DE MARCAÇÃO - LABORATÓRIO", 726, 19, true, brand);
  draw("SIMULAÇÃO SEM VALOR OFICIAL.", 696, 13, true, brand);
  page.drawLine({ start: { x: 42, y: 676 }, end: { x: 553, y: 676 }, thickness: 1, color: brand });
  draw("MARCAÇÃO REGISTRADA", 646, 10, true, soft);
  draw(pointDate(event.marking_at), 616, 19, true);
  draw(pointTime(event.marking_at), 574, 32, true, brand);
  draw("Fortaleza · UTC-03:00 · horário do servidor local", 547, 11, false, soft);
  draw(`Registro concluído: ${pointDate(event.recorded_at)} às ${pointTime(event.recorded_at)}`, 508, 12);
  draw("Marcação e conclusão são instantes distintos preservados pelo servidor.", 486, 10, false, soft);
  draw("REFERÊNCIA DO REGISTRO", 450, 10, true, soft);
  draw(event.reference, 427, event.source === "LEGACY" ? 10 : 14, true);
  draw("DADOS HISTÓRICOS LIMITADOS", 380, 11, true, brand);
  draw("Nome histórico do funcionário não preservado nesta marcação.", 357, 11);
  draw("Identificação legal do empregador e local histórico não preservados.", 337, 11);
  draw("Documento vinculado a uma marcação da conta pessoal autenticada.", 307, 10, false, soft);
  draw("Não interpreta entrada, saída, intervalo ou jornada de trabalho.", 288, 10, false, soft);
  page.drawRectangle({ x: 42, y: 169, width: 511, height: 85, color: rgb(.94,.96,.98) });
  draw("NÃO É COMPROVANTE REP-P OFICIAL.", 226, 12, true, brand);
  draw("NÃO POSSUI ASSINATURA PAdES/ICP-BRASIL.", 202, 11, true, brand);
  draw("Hash técnico não equivale a assinatura. Referência LAB não é NSR oficial.", 181, 9, false, soft);
  draw(`Referência técnica da marcação: ${event.event_id}`, 119, 9, false, soft);
  draw("Documento de laboratório sintético. Não autoriza produção ou ponto oficial.", 99, 9, false, soft);
  draw("Página 1 de 1", 53, 9, false, soft);
  return pdf.save({ useObjectStreams: false });
}
export async function buildPointReceiptZip(events: PersonalRecord[], logoBytes?: Uint8Array) {
  if (!events.length || events.length > 500) throw new Error("EXTRACAO_INVALIDA");
  const files: Record<string, [Uint8Array, { mtime: Date }]> = {};
  for (const record of events) {
    const event = personalRecord.parse(record), filename = pointReceiptFilename(event);
    if (files[filename]) throw new Error("REGISTRO_DUPLICADO");
    files[filename] = [await buildPointReceipt(event, logoBytes), { mtime: new Date("2026-01-01T00:00:00Z") }];
  }
  return zipSync(files, { level: 0 });
}
