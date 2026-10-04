import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { zipSync } from "fflate";
import { onlineRecord4d, personalRecord, type AnyRecord, type OnlineRecord4d } from "@/05_ACESSO_A_DADOS/Ponto/registros";
import { pointDate, pointTime } from "@/03_FUNCOES_E_LOGICA/Ponto/relogio-referencia";
import { buildPointReceipt, pointReceiptFilename } from "./ponto-recibo-4b";

// Marco 4D (teste online): comprovante com os campos que o ponto grava no próprio banco
// (NSR, nome e matrícula na hora da marcação, hash da cadeia). Continua SEM valor oficial:
// faltam empregador/CNPJ reais, CPF, registro INPI do programa, assinatura ICP-Brasil (PAdES) e AFD/AEJ.
export const POINT_RECEIPT_4D_VERSION = "4D-TESTE-v1";
const is4d = (record: AnyRecord): record is OnlineRecord4d => record.source === "4D";
export function onlineReceiptFilename(record: OnlineRecord4d) { return `comprovante-teste-nsr-${onlineRecord4d.parse(record).nsr}.pdf`; }

export async function buildOnlineReceipt4d(record: OnlineRecord4d, logoBytes?: Uint8Array) {
  const event = onlineRecord4d.parse(record);
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Comprovante de marcação NSR ${event.nsr} - teste`); pdf.setAuthor("Metallo - ambiente de teste");
  pdf.setCreator(POINT_RECEIPT_4D_VERSION); pdf.setProducer(POINT_RECEIPT_4D_VERSION);
  pdf.setCreationDate(new Date(event.recorded_at)); pdf.setModificationDate(new Date(event.recorded_at));
  const regular = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595.28, 841.89]);
  const brand = rgb(.04, .29, .48), ink = rgb(.12, .16, .2), soft = rgb(.34, .39, .44);
  const draw = (text: string, y: number, size = 12, strong = false, color = ink, x = 42) => page.drawText(text, { x, y, size, font: strong ? bold : regular, color });
  page.drawRectangle({ x: 0, y: 826, width: 595.28, height: 16, color: brand });
  if (logoBytes) { const logo = await pdf.embedPng(new Uint8Array(logoBytes)); page.drawImage(logo, { x: 42, y: 761, width: 122, height: 47 }); }
  else draw("METALLO", 786, 19, true, brand);
  draw("COMPROVANTE DE REGISTRO DE PONTO", 726, 18, true, brand);
  draw("AMBIENTE DE TESTE · DADOS FICTÍCIOS · SEM VALOR OFICIAL", 702, 11, true, brand);
  page.drawLine({ start: { x: 42, y: 686 }, end: { x: 553, y: 686 }, thickness: 1, color: brand });
  draw("TRABALHADOR", 660, 9, true, soft); draw(event.employee_name, 642, 13, true);
  draw(`Matrícula: ${event.employee_code ?? "não informada"}`, 624, 11);
  draw("NSR (NÚMERO SEQUENCIAL DO REGISTRO)", 590, 9, true, soft); draw(String(event.nsr).padStart(9, "0"), 568, 20, true, brand);
  draw("DATA E HORA DA MARCAÇÃO", 534, 9, true, soft);
  draw(`${pointDate(event.marking_at)} · ${pointTime(event.marking_at)}`, 510, 22, true, brand);
  draw("Fortaleza · UTC-03:00 · hora do servidor no início da marcação (não do aparelho)", 490, 9, false, soft);
  draw(`Gravação concluída: ${pointDate(event.recorded_at)} às ${pointTime(event.recorded_at)}`, 466, 11);
  draw("Coletor: aplicativo Metallo Colaborador (navegador), online.", 448, 11);
  draw("CÓDIGO DE INTEGRIDADE (SHA-256 DA CADEIA DE REGISTROS)", 414, 9, true, soft);
  draw(event.payload_hash.slice(0, 32), 396, 10, true); draw(event.payload_hash.slice(32), 382, 10, true);
  draw("Cada registro guarda o código do anterior: apagar ou alterar um original quebra a cadeia.", 364, 9, false, soft);
  page.drawRectangle({ x: 42, y: 186, width: 511, height: 120, color: rgb(.94, .96, .98) });
  draw("NÃO É COMPROVANTE REP-P OFICIAL (Portaria MTP 671/2021).", 284, 11, true, brand, 54);
  draw("Faltam para o uso oficial: identificação real do empregador (razão social/CNPJ) e do local,", 262, 9, false, ink, 54);
  draw("CPF do trabalhador, registro do programa no INPI, atestado técnico, assinatura eletrônica", 248, 9, false, ink, 54);
  draw("ICP-Brasil (PAdES) deste comprovante e geração do AFD/AEJ.", 234, 9, false, ink, 54);
  draw("Hash técnico não equivale a assinatura.", 210, 9, false, soft, 54);
  draw(`Referência técnica: ${event.event_id}`, 119, 9, false, soft);
  draw("Documento do ambiente de teste online do Metallo. Não usar com funcionários reais.", 99, 9, false, soft);
  draw("Página 1 de 1", 53, 9, false, soft);
  return pdf.save({ useObjectStreams: false });
}

// Laboratório (4A/legado) e teste online (4D) usam o gerador próprio de cada origem.
export function anyReceiptFilename(record: AnyRecord) { return is4d(record) ? onlineReceiptFilename(record) : pointReceiptFilename(personalRecord.parse(record)); }
export function buildAnyReceipt(record: AnyRecord, logoBytes?: Uint8Array) {
  return is4d(record) ? buildOnlineReceipt4d(record, logoBytes) : buildPointReceipt(personalRecord.parse(record), logoBytes);
}
export async function buildAnyReceiptZip(events: AnyRecord[], logoBytes?: Uint8Array) {
  if (!events.length || events.length > 500) throw new Error("EXTRACAO_INVALIDA");
  const files: Record<string, [Uint8Array, { mtime: Date }]> = {};
  for (const record of events) {
    const filename = anyReceiptFilename(record);
    if (files[filename]) throw new Error("REGISTRO_DUPLICADO");
    files[filename] = [await buildAnyReceipt(record, logoBytes), { mtime: new Date("2026-01-01T00:00:00Z") }];
  }
  return zipSync(files, { level: 0 });
}
