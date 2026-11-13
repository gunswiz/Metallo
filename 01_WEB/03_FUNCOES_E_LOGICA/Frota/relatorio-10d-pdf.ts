import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { LinhaRelatorio10d } from "./contrato-10a";

export async function pdfRelatorioFrota(mes: string, linhas: LinhaRelatorio10d[]) {
  const doc = await PDFDocument.create();
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const titulo = await doc.embedFont(StandardFonts.HelveticaBold);
  const azul = rgb(0.04, 0.21, 0.34);
  const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const suportados = new Set(fonte.getCharacterSet());
  const texto = (s: string) => Array.from(s, c => suportados.has(c.codePointAt(0)!) ? c : " ").join("");
  let pagina = doc.addPage([595, 842]);
  let y = 0;
  function cabecalho() {
    pagina.drawText("METALLO  /  FROTA", { x: 36, y: 795, font: titulo, size: 11, color: azul });
    pagina.drawText(`Relatório mensal · ${mes.slice(5)}/${mes.slice(0, 4)}`, { x: 36, y: 760, font: titulo, size: 21 });
    y = 725;
  }
  function escrever(s: string, destaque = false) {
    if (y < 55) { pagina = doc.addPage([595, 842]); cabecalho(); }
    pagina.drawText(texto(s), { x: 36, y, size: destaque ? 13 : 11, font: destaque ? titulo : fonte, color: azul });
    y -= 19;
  }
  cabecalho();
  const grupos = [...linhas.map(l => ({ nome: `${l.placa} · ${l.nome}`, dados: l })),
    { nome: "Total da frota", dados: linhas.reduce((s,l) => ({
      saidas:s.saidas+l.saidas, km_rodados:s.km_rodados+l.km_rodados, checklists:s.checklists+l.checklists,
      itens_com_problema:s.itens_com_problema+l.itens_com_problema, defeitos_abertos:s.defeitos_abertos+l.defeitos_abertos,
      manutencoes_concluidas:s.manutencoes_concluidas+l.manutencoes_concluidas, dias_parado:s.dias_parado+l.dias_parado,
      custo:s.custo+l.custo
    }), { saidas:0, km_rodados:0, checklists:0, itens_com_problema:0, defeitos_abertos:0, manutencoes_concluidas:0, dias_parado:0, custo:0 }) }];
  if (!linhas.length) escrever("Nenhum veículo no período.");
  for (const {nome, dados: l} of grupos) {
    if (y < 150) { pagina = doc.addPage([595, 842]); cabecalho(); }
    let trecho = "";
    for (const c of texto(nome)) {
      if (titulo.widthOfTextAtSize(trecho + c, 13) > 518) { escrever(trecho, true); trecho = ""; }
      trecho += c;
    }
    escrever(trecho, true);
    escrever(`Saídas: ${l.saidas}     Km rodados: ${l.km_rodados.toLocaleString("pt-BR")}     Checklists: ${l.checklists}`);
    escrever(`Itens com problema: ${l.itens_com_problema}     Defeitos abertos: ${l.defeitos_abertos}`);
    escrever(`Manutenções concluídas: ${l.manutencoes_concluidas}     Dias parados: ${l.dias_parado}`);
    escrever(`Custo de manutenção: ${moeda.format(l.custo)}`);
    y -= 12;
  }
  doc.getPages().forEach((p,i) => p.drawText(`${i+1} / ${doc.getPageCount()}`, {x: 515, y: 25, size: 9, font: fonte}));
  return doc.save();
}
