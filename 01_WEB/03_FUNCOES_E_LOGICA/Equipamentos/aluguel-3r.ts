import { lerPrecoBR } from "@/03_FUNCOES_E_LOGICA/Precos/precos-3q";

// Marco 3R: equipamento alugado — número do contrato e valor real do equipamento (NÃO é o valor do aluguel).
/** Vazio → null. Até 60 caracteres, sem quebras de linha. Inválido → undefined. */
export function lerContrato3r(texto: string | null | undefined): string | null | undefined {
  const limpo = (texto ?? "").trim().replace(/\s+/g, " ");
  if (!limpo) return null;
  if (limpo.length > 60 || /[\u0000-\u001f\u007f]/.test(limpo)) return undefined;
  return limpo;
}

/** Valor do equipamento em R$ ("15.000,00"). Vazio → null; inválido → undefined. */
export function lerValorEquipamento3r(texto: string | null | undefined): number | null | undefined {
  const valor = lerPrecoBR(texto);
  if (valor === undefined || valor === null) return valor;
  return valor < 100_000_000 ? valor : undefined;
}

export function mostrarReais3r(valor: number | null | undefined) {
  return valor == null ? "Não informado" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}
