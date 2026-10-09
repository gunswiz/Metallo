// Marco 4F — validações dos dados do ponto oficial (Portaria 671, AFD v004). Sem valor oficial no teste.
export const soDigitos = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

export function cpfValido(valor: string | null | undefined) {
  const p = soDigitos(valor);
  if (!/^\d{11}$/.test(p) || /^(\d)\1{10}$/.test(p)) return false;
  const dv = (n: number) => { let s = 0; for (let i = 0; i < n; i++) s += Number(p[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(p[9]) && dv(10) === Number(p[10]);
}

export function cnpjValido(valor: string | null | undefined) {
  const p = soDigitos(valor);
  if (!/^\d{14}$/.test(p) || /^(\d)\1{13}$/.test(p)) return false;
  const dv = (n: number) => { const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = pesos.reduce((t, w, i) => t + Number(p[i]) * w, 0); const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return dv(12) === Number(p[12]) && dv(13) === Number(p[13]);
}

export function mostrarCnpj(v: string) { const p = soDigitos(v); return p.length === 14 ? `${p.slice(0, 2)}.${p.slice(2, 5)}.${p.slice(5, 8)}/${p.slice(8, 12)}-${p.slice(12)}` : p; }

/** CRC-16/KERMIT (CCITT-TRUE), usado nos registros 1 a 5 do AFD. "123456789" → "2189". */
export function crc16Kermit(texto: string) {
  let crc = 0;
  for (const ch of texto) { const code = ch.codePointAt(0)!; crc ^= code < 256 ? code : 63; for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0x8408 : crc >>> 1; }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Texto do AFD em bytes ISO-8859-1 (exigência do leiaute). Caractere fora da tabela vira "?". */
export function latin1(texto: string) { return Uint8Array.from([...texto].map(c => { const code = c.codePointAt(0)!; return code < 256 ? code : 63; })); }

export const MENSAGENS_4F: Record<string, string> = {
  "cpf-invalido": "CPF inválido. Confira os 11 números.",
  "cpf-em-uso": "Este CPF já está cadastrado para outra pessoa.",
  "empresa-invalida": "Confira os dados da empresa: CNPJ (14 números) ou CPF (11), razão social e local.",
  falhou: "Não foi possível salvar agora. Tente de novo.",
  "afd-periodo": "Escolha um período válido (até 366 dias).",
  "afd-empresa": "Cadastre os dados da empresa antes de gerar o AFD.",
  "afd-falhou": "Não foi possível gerar o AFD agora.",
};
