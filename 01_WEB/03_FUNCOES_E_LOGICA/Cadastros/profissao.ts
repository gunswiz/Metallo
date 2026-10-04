// O cadastro guarda o CÓDIGO da profissão (catálogo epi_professions). Em telas e PDFs mostramos o nome.
// Códigos do catálogo-base; profissões criadas pela empresa com outro código aparecem como foram gravadas.
const NOMES: Record<string, string> = {
  welder: "Soldador", helper: "Ajudante", assembler: "Montador", painter: "Pintor",
  leader: "Encarregado", munck_operator: "Operador de Munck",
};
export function nomeProfissao(valor: string | null | undefined): string {
  if (!valor) return "";
  return NOMES[valor.trim()] ?? valor;
}
