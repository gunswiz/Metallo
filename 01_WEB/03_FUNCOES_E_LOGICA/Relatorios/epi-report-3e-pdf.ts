import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import { epiPrintedSupplies, reportDate, type EpiReport } from "./epi-report-3e";

const safe = (value: unknown) => String(value ?? "Não registrado").normalize("NFC")
  .replace(/[^\x20-\x7e\xa0-\xff]/g, " ").replace(/\s+/g, " ").trim();
export const EPI_REPORT_FORMAT_VERSION = "3E-LAB-v3";
const filenameId = (id: string) => id.replace(/[^a-z0-9-]/gi, "").slice(0, 36);
export function epiReportFilename(report: EpiReport) {
  return `${report.type === "current" ? "ficha-atual" : "historico"}-epi-${filenameId(report.payload.report_id)}.pdf`;
}

export async function buildEpiReport3ePdf(report: EpiReport, logoBytes?: Uint8Array) {
  const supplies = epiPrintedSupplies(report);
  if (report.type === "history" && supplies.length > 1200) throw new Error("Relatório muito extenso. Escolha um período menor.");
  if (report.type === "current" && supplies.length > 1200) throw new Error("Ficha muito extensa. Solicite conferência à administração.");
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = logoBytes ? await pdf.embedPng(new Uint8Array(logoBytes)) : null;
  const ink = rgb(0.12, 0.16, 0.2), muted = rgb(0.35, 0.4, 0.45);
  const brand = rgb(0.04, 0.29, 0.48), pale = rgb(0.94, 0.96, 0.97);
  const left = 42, right = 553, width = right - left;
  let page!: PDFPage, y = 0;
  const fit = (text: string, font: PDFFont, size: number, maxWidth: number) => {
    const lines: string[] = [];
    let line = "";
    for (const word of safe(text).split(" ")) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) { line = candidate; continue; }
      if (line) lines.push(line);
      line = "";
      for (const char of word) {
        if (font.widthOfTextAtSize(line + char, size) > maxWidth && line) { lines.push(line); line = ""; }
        line += char;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  };
  const draw = (text: string, x: number, at: number, size = 9, strong = false, color = ink) =>
    page.drawText(safe(text), { x, y: at, size, font: strong ? bold : regular, color });
  const line = (text: string, size = 9, strong = false, color = ink, indent = 0) => {
    for (const part of fit(text, strong ? bold : regular, size, width - indent)) {
      draw(part, left + indent, y, size, strong, color);
      y -= size + 4;
    }
  };
  const newPage = () => {
    page = pdf.addPage([595.28, 841.89]);
    page.drawRectangle({ x: 0, y: 824, width: 595.28, height: 17, color: brand });
    if (logo) page.drawImage(logo, { x: left, y: 772, width: 122, height: 47 });
    else draw("METALLO", left, 791, 15, true, brand);
    draw("SIMULAÇÃO SEM VALOR OFICIAL", 342, 793, 8, true, muted);
    page.drawLine({ start: { x: left, y: 762 }, end: { x: right, y: 762 }, thickness: 0.8, color: brand });
    y = 740;
    if (pdf.getPageCount() > 1) {
      line(report.type === "current" ? `FICHA ATUAL DE EPI - situação em ${reportDate(report.payload.generated_at)}` :
        `HISTÓRICO DE EPI - ${report.period.label}`, 9, true, brand);
      y -= 4;
    }
  };
  const ensure = (height: number) => { if (y - height < 78) newPage(); };
  newPage();
  line(report.type === "current" ? "FICHA ATUAL DE EPI" : "HISTÓRICO DE EPI", 18, true, brand);
  y -= 8;
  line(`Funcionário: ${report.payload.employee.name}`, 11, true);
  line([report.payload.employee.registration ? `Matrícula: ${report.payload.employee.registration}` : "",
    `Função atual: ${report.payload.employee.profession || "Não registrada"}`].filter(Boolean).join("  |  "));
  line(report.type === "current" ? `Situação em ${reportDate(report.payload.generated_at)}` :
    report.period.preset === "all" ? "Período consultado: TODO O HISTÓRICO" :
      `Período consultado: ${report.period.label}  |  RELATÓRIO FILTRADO POR PERÍODO`, 9, true);
  if (report.legacyCount) line("Em registros legados, descrição e unidade vêm do catálogo atual; não há snapshot desses campos.", 8, false, muted);
  y -= 15;
  const cards = supplies.map(row => ({ title: report.type === "current" ? row.item : row.title,
    subtitle: `${report.type === "current" ? "Data da entrega" : "Data"}: ${reportDate(row.at)}`,
    details: [
      report.type === "history" ? `EPI: ${row.item}` : "",
      `CA: ${row.ca}  |  Quantidade: ${row.quantity}`,
      row.variant ? `Tamanho / variante: ${row.variant}` : "",
      `Responsável pela entrega: ${row.responsible}`,
      row.receipt,
    ].filter(Boolean) }));
  if (!cards.length) {
    ensure(58);
    page.drawRectangle({ x: left, y: y - 47, width, height: 52, color: pale });
    y -= 16;
    line(report.type === "current" ? "Nenhum EPI atribuído no momento. Isto não significa ausência de entregas passadas." :
      "Nenhuma entrega ou substituição registrada no período selecionado.", 9, true, ink, 10);
    y -= 32;
  }
  for (const card of cards) {
    const details = card.details.flatMap(value => fit(value, regular, 9, width - 22));
    const title = fit(card.title, bold, 11, width - 22);
    const subtitle = fit(card.subtitle, regular, 9, width - 22);
    const height = 20 + title.length * 15 + subtitle.length * 13 + details.length * 13 + 10;
    if (height > 670) {
      const lines = [...title.map(text => ({ text, size: 11, strong: true })),
        ...subtitle.map(text => ({ text, size: 9, strong: false })),
        ...details.map(text => ({ text, size: 9, strong: false }))];
      for (const part of lines) {
        if (y - 18 < 78) {
          newPage();
          line(`Continuação: ${safe(card.title).slice(0, 90)}`, 9, true, brand);
          y -= 7;
        }
        page.drawRectangle({ x: left, y: y - 5, width, height: 17, color: pale });
        draw(part.text, left + 11, y, part.size, part.strong, part.strong ? brand : ink);
        y -= part.size + 5;
      }
      y -= 17;
      continue;
    }
    ensure(height + 8);
    page.drawRectangle({ x: left, y: y - height + 8, width, height, color: pale });
    y -= 13;
    for (const part of title) { draw(part, left + 11, y, 11, true, brand); y -= 15; }
    for (const part of subtitle) { draw(part, left + 11, y, 9); y -= 13; }
    y -= 2;
    for (const part of details) { draw(part, left + 11, y, 9); y -= 13; }
    y -= 21;
  }
  // Sem campos de assinatura manuscrita: o fornecimento é registrado em sistema eletrônico
  // e cada entrega mostra a confirmação feita pelo próprio funcionário no portal.
  const notice = "Fornecimento registrado em sistema eletrônico (NR-6, item 6.5.1, alínea \"d\"). " +
    "A situação de cada entrega mostra a confirmação feita pelo próprio funcionário no portal. " +
    "Este relatório é extraído do sistema (NR-6, item 6.5.1.1) e não depende de assinatura manuscrita.";
  ensure(40 + fit(notice, regular, 8, width).length * 12);
  y -= 4;
  line("REGISTRO ELETRÔNICO", 9, true, brand);
  line(notice, 8, false, muted);
  const pages = pdf.getPages();
  pages.forEach((p, index) => {
    p.drawLine({ start: { x: left, y: 60 }, end: { x: right, y: 60 }, thickness: 0.5, color: muted });
    p.drawText(`Página ${index + 1} de ${pages.length}`,
      { x: left, y: 45, size: 8, font: regular, color: muted });
  });
  pdf.setTitle(report.type === "current" ? "Ficha atual de EPI" : "Histórico de EPI");
  pdf.setAuthor("Metallo - laboratório");
  // Identificador e versão ficam em metadados/arquivo, sem sobrecarregar a via impressa.
  pdf.setSubject(`Relatório ${EPI_REPORT_FORMAT_VERSION} - ${report.payload.report_id} - ${report.payload.generated_at}`);
  return pdf.save();
}
