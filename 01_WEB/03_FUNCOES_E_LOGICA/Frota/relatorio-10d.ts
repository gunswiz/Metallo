import type { LinhaRelatorio10d } from "./contrato-10a";

// Marco 10D — relatório do mês da frota em CSV (abre direto no Excel em português: separador ";", vírgula decimal, acentos corretos).
export const MES_RELATORIO_10D = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Evita que uma célula vire fórmula no Excel (nome começando com = + - @). */
const celula = (valor: string | number) => {
  const texto = String(valor);
  const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
  return /[";\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
};
const reais = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const CABECALHO_RELATORIO_10D = ["Caminhão", "Placa", "Saídas", "Km rodados", "Checklists feitos", "Itens com problema", "Defeitos abertos", "Manutenções concluídas", "Dias parado", "Custo de manutenção (R$)"];

export function csvRelatorio10d(linhas: LinhaRelatorio10d[]) {
  const corpo = linhas.map(l => [l.nome, l.placa, l.saidas, l.km_rodados, l.checklists, l.itens_com_problema, l.defeitos_abertos, l.manutencoes_concluidas, l.dias_parado, reais(l.custo)].map(celula).join(";"));
  const total = (campo: "saidas" | "km_rodados" | "checklists" | "itens_com_problema" | "defeitos_abertos" | "manutencoes_concluidas" | "dias_parado") => linhas.reduce((s, l) => s + l[campo], 0);
  const soma = ["Total", "", total("saidas"), total("km_rodados"), total("checklists"), total("itens_com_problema"), total("defeitos_abertos"), total("manutencoes_concluidas"), total("dias_parado"), reais(linhas.reduce((s, l) => s + l.custo, 0))].map(celula).join(";");
  return "﻿" + [CABECALHO_RELATORIO_10D.map(celula).join(";"), ...corpo, soma].join("\r\n") + "\r\n";
}
