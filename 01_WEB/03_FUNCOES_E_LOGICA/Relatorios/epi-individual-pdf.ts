import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFPage,
  type PDFFont,
} from "pdf-lib";
import type { EpiDeliveryReportRow } from "@/05_ACESSO_A_DADOS/Repositorios/metallo-repository";
export type IndividualReceiptInput = {
  employee: {
    id: string;
    full_name: string;
    registration_code: string | null;
    profession: string;
  };
  deliveries: EpiDeliveryReportRow[];
  generatedBy: string;
  generatedAt?: Date;
  periodLabel: string;
};
const clean = (text: unknown) =>
  String(text ?? "-")
    .normalize("NFC")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, " ")
    .trim();
function wrap(text: string, font: PDFFont, width: number, size = 9) {
  const lines: string[] = [];
  let line = "";
  for (const character of clean(text)) {
    if (font.widthOfTextAtSize(line + character, size) > width) {
      lines.push(line);
      line = "";
    }
    line += character;
  }
  lines.push(line);
  return lines;
}
export async function buildIndividualEpiPdf(input: IndividualReceiptInput) {
  if (input.deliveries.some((d) => d.epi_employees?.id !== input.employee.id))
    throw Error("mixed_employee_receipt");
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const blue = rgb(0.06, 0.25, 0.48),
    ink = rgb(0.12, 0.16, 0.21),
    muted = rgb(0.35, 0.4, 0.46);
  let page!: PDFPage;
  let y = 0;
  const date = (value: string) =>
    new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeZone: "America/Fortaleza",
    }).format(new Date(value));
  const write = (
    value: string,
    x: number,
    at: number,
    size = 9,
    strong = false,
  ) =>
    page.drawText(clean(value), {
      x,
      y: at,
      size,
      font: strong ? bold : font,
      color: ink,
    });
  const header = () => {
    page = document.addPage([595.28, 841.89]);
    page.drawText("METALLO", {
      x: 36,
      y: 800,
      size: 20,
      font: bold,
      color: blue,
    });
    write("Ficha individual de recebimento de EPI", 36, 775, 15, true);
    const name = wrap(input.employee.full_name, bold, 523, 12);
    name.forEach((line, index) => write(line, 36, 750 - index * 15, 12, true));
    y = 750 - name.length * 15;
    const metadata = wrap(
      `Matrícula: ${input.employee.registration_code ?? "Não informada"} | Profissão: ${input.employee.profession}`,
      font,
      523,
    );
    metadata.forEach((line, index) => write(line, 36, y - index * 12, 9));
    y -= metadata.length * 12 + 5;
    write(`Período: ${input.periodLabel}`, 36, y, 9);
    y -= 22;
    page.drawRectangle({
      x: 36,
      y: y - 24,
      width: 523,
      height: 24,
      color: rgb(0.9, 0.94, 0.98),
    });
    ["Entrega", "Item / variante", "C.A.", "Qtd."].forEach((label, index) =>
      write(label, [42, 110, 410, 490][index], y - 15, 9, true),
    );
    y -= 24;
  };
  header();
  const deliveries = input.deliveries
    .filter((d) => d.epi_items?.item_kind === "epi")
    .sort((a, b) => a.delivered_at.localeCompare(b.delivered_at));
  for (const row of deliveries) {
    const item = wrap(
      `${row.epi_items?.name ?? "EPI"}${row.variant_snapshot ? " - " + row.variant_snapshot : ""}`,
      font,
      282,
    );
    const ca = wrap(row.ca_snapshot ?? "Não informado", font, 70);
    const height = Math.max(item.length, ca.length) * 12 + 14;
    if (y - height < 145) header();
    write(date(row.delivered_at), 42, y - 15);
    item.forEach((line, i) => write(line, 110, y - 15 - i * 12));
    ca.forEach((line, i) => write(line, 410, y - 15 - i * 12));
    write(String(row.quantity), 490, y - 15, 10, true);
    y -= height;
    page.drawLine({
      start: { x: 36, y },
      end: { x: 559, y },
      thickness: 0.4,
      color: rgb(0.8, 0.83, 0.87),
    });
  }
  if (!deliveries.length) {
    write("Nenhuma entrega de EPI registrada neste período.", 36, y - 25, 11);
    y -= 45;
  }
  if (y < 185) header();
  y -= 30;
  const declaration = `Confirmo o recebimento das ${deliveries.reduce((total, row) => total + row.quantity, 0)} unidades de EPI relacionadas nesta ficha, em ${document.getPageCount()} página(s).`;
  wrap(declaration, font, 523, 10).forEach((line, i) =>
    write(line, 36, y - i * 14, 10),
  );
  y -= 66;
  page.drawLine({
    start: { x: 36, y },
    end: { x: 360, y },
    thickness: 0.7,
    color: ink,
  });
  write("Assinatura do funcionário", 36, y - 15);
  write("Data: ____ / ____ / ________", 390, y - 15);
  y -= 54;
  page.drawLine({
    start: { x: 36, y },
    end: { x: 360, y },
    thickness: 0.7,
    color: ink,
  });
  write("Responsável pela entrega / conferência", 36, y - 15);
  const pages = document.getPages();
  pages.forEach((p, index) => {
    p.drawText(
      `Página ${index + 1} de ${pages.length} | Funcionário: ${clean(input.employee.full_name).slice(0, 65)}`,
      { x: 36, y: 42, size: 8, font, color: muted },
    );
    p.drawText(
      `Gerado por ${clean(input.generatedBy).slice(0, 65)} em ${date((input.generatedAt ?? new Date()).toISOString())}`,
      { x: 36, y: 28, size: 7, font, color: muted },
    );
  });
  document.setTitle(`Ficha de EPI - ${clean(input.employee.full_name)}`);
  document.setAuthor("Metallo");
  return document.save();
}
