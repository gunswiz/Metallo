import { PDFDocument, PageSizes, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { itemKindLabel, statusLabel } from "@metallo/core";
import type { EpiDeliveryReportRow } from "@/lib/repositories/metallo-repository";

const pageWidth = PageSizes.A4[1];
const pageHeight = PageSizes.A4[0];
const margin = 28;
const footerHeight = 24;
const bodySize = 7.2;
const lineHeight = 9;
const columns = [
  { key: "date", label: "Data", width: 64 },
  { key: "employee", label: "Funcionário", width: 116 },
  { key: "team", label: "Equipe", width: 78 },
  { key: "item", label: "Item", width: 132 },
  { key: "details", label: "Variante e rastreio", width: 112 },
  { key: "quantity", label: "Qtd.", width: 44 },
  { key: "reason", label: "Motivo", width: 76 },
  { key: "status", label: "Situação", width: 72 },
  { key: "actor", label: "Responsável", width: 90 },
] as const;

const colors = {
  navy: rgb(0.025, 0.085, 0.125),
  panel: rgb(0.055, 0.13, 0.18),
  panelAlt: rgb(0.075, 0.16, 0.215),
  blue: rgb(0.086, 0.55, 1),
  white: rgb(0.965, 0.98, 0.99),
  muted: rgb(0.62, 0.72, 0.78),
  line: rgb(0.15, 0.27, 0.34),
  warning: rgb(0.97, 0.72, 0.29),
};

const reasonLabels: Readonly<Record<string, string>> = {
  initial: "Primeira entrega",
  replacement: "Substituição",
  additional: "Adicional",
};

export type EpiPdfInput = {
  deliveries: EpiDeliveryReportRow[];
  actorNames: Record<string, string>;
  from: Date;
  toInclusive: Date;
  teamName: string;
  generatedBy: string;
  generatedAt?: Date;
  truncated?: boolean;
};

function safeText(value: unknown, fallback = "-") {
  const raw = String(value ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim() || fallback;
  return Array.from(raw)
    .map((character) => {
      if (character === "–" || character === "—" || character === "‑") return "-";
      if (character === "“" || character === "”") return '"';
      if (character === "‘" || character === "’") return "'";
      return character.charCodeAt(0) <= 255 ? character : "?";
    })
    .join("");
}

function safeMultilineText(value: unknown, fallback = "-") {
  const paragraphs = String(value ?? "")
    .replace(/\r/g, "")
    .split("\n")
    .map((paragraph) => safeText(paragraph, ""))
    .filter(Boolean);
  return paragraphs.join("\n") || fallback;
}

function dateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Fortaleza",
  }).format(new Date(value));
}

function dateOnly(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Fortaleza" }).format(value);
}

function wrapText(value: string, font: PDFFont, size: number, maximumWidth: number) {
  const lines: string[] = [];
  for (const paragraph of safeMultilineText(value).split("\n")) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maximumWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      if (font.widthOfTextAtSize(word, size) <= maximumWidth) {
        line = word;
        continue;
      }
      let fragment = "";
      for (const character of word) {
        if (fragment && font.widthOfTextAtSize(fragment + character, size) > maximumWidth) {
          lines.push(fragment);
          fragment = character;
        } else {
          fragment += character;
        }
      }
      line = fragment;
    }
    lines.push(line || "-");
  }
  return lines;
}

function drawLines(page: PDFPage, lines: string[], x: number, y: number, font: PDFFont, size: number, color = colors.white) {
  lines.forEach((line, index) => page.drawText(line, { x, y: y - index * lineHeight, font, size, color }));
}

function rowValues(row: EpiDeliveryReportRow, actorNames: Record<string, string>) {
  const employee = row.epi_employees;
  const item = row.epi_items;
  return {
    date: dateTime(row.delivered_at),
    employee: [employee?.full_name, employee?.registration_code, employee?.profession].filter(Boolean).join("\n"),
    team: row.teams?.name ?? "Sem equipe",
    item: [itemKindLabel(item?.item_kind), item?.name, item?.code].filter(Boolean).join("\n"),
    details: [
      `Var.: ${row.variant_snapshot ?? "-"}`,
      `C.A.: ${row.ca_snapshot ?? "-"}`,
      `Marca: ${row.brand_model_snapshot ?? "-"}`,
      `Lote: ${row.lot_snapshot ?? "-"}`,
    ].join("\n"),
    quantity: `${row.quantity} ${item?.unit ?? "un"}`,
    reason: reasonLabels[row.delivery_reason] ?? row.delivery_reason,
    status: [statusLabel(row.current_status), row.closed_at ? `Baixa: ${dateTime(row.closed_at)}` : null].filter(Boolean).join("\n"),
    actor: [
      `Entrega: ${actorNames[row.delivered_by] ?? "Usuário não identificado"}`,
      row.closed_by ? `Baixa: ${actorNames[row.closed_by] ?? "Usuário não identificado"}` : null,
    ].filter(Boolean).join("\n"),
  };
}

export async function buildEpiMovementPdf(input: EpiPdfInput) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const generatedAt = input.generatedAt ?? new Date();
  document.setTitle("Relatório detalhado de movimentações de EPI");
  document.setAuthor("Metallo");
  document.setSubject(`Movimentações de EPI - ${input.teamName}`);
  document.setCreator("Metallo Web");
  document.setProducer("Metallo Web");
  document.setCreationDate(generatedAt);
  document.setModificationDate(generatedAt);

  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
  let page!: PDFPage;
  let y = 0;

  const drawTableHeader = () => {
    page.drawRectangle({ x: margin, y: y - 20, width: tableWidth, height: 20, color: colors.blue });
    let x = margin;
    for (const column of columns) {
      page.drawText(column.label, { x: x + 4, y: y - 13, font: bold, size: 7, color: colors.navy });
      x += column.width;
    }
    y -= 20;
  };

  const addPage = (continued = false) => {
    page = document.addPage([pageWidth, pageHeight]);
    page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: colors.navy });
    page.drawText("METALLO", { x: margin, y: pageHeight - 32, font: bold, size: 16, color: colors.blue });
    page.drawText(continued ? "Relatório de EPI - continuação" : "Relatório detalhado de movimentações de EPI", {
      x: margin + 94,
      y: pageHeight - 31,
      font: bold,
      size: continued ? 12 : 15,
      color: colors.white,
    });
    page.drawText(`Período: ${dateOnly(input.from)} a ${dateOnly(input.toInclusive)} | Equipe: ${safeText(input.teamName)}`, {
      x: margin,
      y: pageHeight - 50,
      font: regular,
      size: 8,
      color: colors.muted,
    });
    y = pageHeight - 64;
    if (!continued) {
      const active = input.deliveries.filter((row) => row.current_status === "active").length;
      const employees = new Set(input.deliveries.map((row) => row.epi_employees?.id).filter(Boolean)).size;
      const summary = [
        ["Registros", String(input.deliveries.length)],
        ["Funcionários", String(employees)],
        ["Em uso", String(active)],
        ["Encerrados", String(input.deliveries.length - active)],
      ];
      const cardWidth = (tableWidth - 24) / 4;
      summary.forEach(([label, value], index) => {
        const x = margin + index * (cardWidth + 8);
        page.drawRectangle({ x, y: y - 42, width: cardWidth, height: 38, color: colors.panel, borderColor: colors.line, borderWidth: 0.7 });
        page.drawText(value, { x: x + 9, y: y - 25, font: bold, size: 14, color: colors.white });
        page.drawText(label, { x: x + 9, y: y - 36, font: regular, size: 7, color: colors.muted });
      });
      y -= 52;
      if (input.truncated) {
        page.drawText("Limite de 3.000 registros atingido. Refine o período para uma auditoria completa.", {
          x: margin,
          y: y - 1,
          font: bold,
          size: 8,
          color: colors.warning,
        });
        y -= 14;
      }
    }
    drawTableHeader();
  };

  addPage();
  if (input.deliveries.length === 0) {
    page.drawText("Nenhuma movimentação de EPI foi encontrada para os filtros selecionados.", {
      x: margin + 10,
      y: y - 30,
      font: regular,
      size: 11,
      color: colors.muted,
    });
  }

  input.deliveries.forEach((row, rowIndex) => {
    const values = rowValues(row, input.actorNames);
    const wrapped = columns.map((column) => wrapText(values[column.key], regular, bodySize, column.width - 8));
    const contentLines = Math.max(...wrapped.map((lines) => lines.length));
    const auditLine = `Registro: ${row.id}${row.note ? ` | Observação: ${safeText(row.note)}` : ""}`;
    const auditLines = wrapText(auditLine, regular, 6.6, tableWidth - 8);
    const rowHeight = Math.max(31, contentLines * lineHeight + auditLines.length * 8 + 10);
    if (y - rowHeight < footerHeight + 12) addPage(true);

    page.drawRectangle({
      x: margin,
      y: y - rowHeight,
      width: tableWidth,
      height: rowHeight,
      color: rowIndex % 2 === 0 ? colors.panel : colors.panelAlt,
    });
    let x = margin;
    wrapped.forEach((lines, columnIndex) => {
      drawLines(page, lines, x + 4, y - 11, regular, bodySize);
      x += columns[columnIndex].width;
      if (columnIndex < columns.length - 1) {
        page.drawLine({ start: { x, y }, end: { x, y: y - rowHeight }, thickness: 0.35, color: colors.line });
      }
    });
    drawLines(page, auditLines, margin + 4, y - contentLines * lineHeight - 8, regular, 6.6, colors.muted);
    y -= rowHeight;
  });

  const pages = document.getPages();
  pages.forEach((currentPage, index) => {
    currentPage.drawLine({ start: { x: margin, y: footerHeight }, end: { x: pageWidth - margin, y: footerHeight }, thickness: 0.5, color: colors.line });
    currentPage.drawText(`Gerado por ${safeText(input.generatedBy)} em ${dateTime(generatedAt.toISOString())}`, {
      x: margin,
      y: 10,
      font: regular,
      size: 6.8,
      color: colors.muted,
    });
    const pageLabel = `Página ${index + 1} de ${pages.length}`;
    currentPage.drawText(pageLabel, {
      x: pageWidth - margin - regular.widthOfTextAtSize(pageLabel, 6.8),
      y: 10,
      font: regular,
      size: 6.8,
      color: colors.muted,
    });
  });

  return document.save();
}

export function epiReportFilename(from: Date, toInclusive: Date) {
  const iso = (value: Date) => new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
  return `relatorio-epi-${iso(from)}-a-${iso(toInclusive)}.pdf`;
}
