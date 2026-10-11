import "server-only";
import { z } from "zod";
import { createClient } from "@/05_ACESSO_A_DADOS/Supabase/server";
import { readPointMirror } from "@/05_ACESSO_A_DADOS/Ponto/ponto-gestao";
import { lerCpfs4f, lerFeriados4h, lerJornada4g, lerOcorrencias4h } from "@/05_ACESSO_A_DADOS/Ponto/oficial-4f";
import { intervaloDoMes, montarEspelho, type Espelho, type Jornada, type MarcacaoEspelho, type TipoOcorrencia } from "@/03_FUNCOES_E_LOGICA/Ponto/espelho-4e";
import { fechamentoGestao4l } from "@/03_FUNCOES_E_LOGICA/Ponto/fechamento-4l";

// Marco 4L: o mês de todas as pessoas (mesmas regras do espelho 4E/4G/4H). Só administrador; banco e Edge Function conferem.
export type PessoaMes4l = { employee_id: string; nome: string; matricula: string | null; espelho: Espelho };
export async function carregarMes4l(mes: string, agora = new Date()): Promise<{ pessoas: PessoaMes4l[]; jornada: Jornada; erro: boolean }> {
  const { de, ate } = intervaloDoMes(mes);
  const leitura = await readPointMirror(mes).then(eventos => ({ eventos, erro: false }), () => ({ eventos: [] as MarcacaoEspelho[], erro: true }));
  const [jornada, feriadosLista, ocorrenciasLista, pessoasAtivas] = await Promise.all([lerJornada4g(), lerFeriados4h(de, ate),
    lerOcorrencias4h(de, ate).catch(() => []), lerCpfs4f().catch(() => [])]);
  const feriados = Object.fromEntries(feriadosLista.map(f => [f.data, f.nome]));
  const ocorrencias: Record<string, Record<string, { tipo: TipoOcorrencia; id: number }>> = {};
  for (const o of ocorrenciasLista) (ocorrencias[o.employee_id] ??= {})[o.data] = { tipo: o.tipo, id: o.id };
  const nomes = new Map<string, { nome: string; matricula: string | null }>(pessoasAtivas.map(p => [p.employee_id, { nome: p.full_name, matricula: p.registration_code }]));
  for (const e of leitura.eventos) if (!nomes.has(e.employee_id)) nomes.set(e.employee_id, { nome: e.employee_name, matricula: e.employee_code });
  const pessoas = [...nomes.entries()].map(([id, p]) => ({ employee_id: id, ...p,
    espelho: montarEspelho(leitura.eventos.filter(e => e.employee_id === id), mes, agora, jornada, { feriados, ocorrencias: ocorrencias[id] ?? {} }) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return { pessoas, jornada, erro: leitura.erro };
}

export async function lerFechamentos4l(mes: string) {
  const r = await (await createClient()).rpc("admin_fechamentos_4l" as never, { p_mes: mes } as never);
  if (r.error) throw new Error("Não foi possível ler os fechamentos.");
  return z.array(fechamentoGestao4l).parse(r.data);
}
