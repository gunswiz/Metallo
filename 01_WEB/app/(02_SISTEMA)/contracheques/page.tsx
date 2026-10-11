import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, FileText, Upload } from "lucide-react";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { mesAnterior, mesAtual, mesSeguinte, mesValido, nomeDoMes } from "@/03_FUNCOES_E_LOGICA/Ponto/espelho-4e";
import { lerCpfs4f, oficialLiberado4f } from "@/05_ACESSO_A_DADOS/Ponto/oficial-4f";
import { lerContracheques6a, TIPOS_FOLHA } from "@/05_ACESSO_A_DADOS/Arquivos/arquivos-6";
import { removerContracheque6a } from "@/app/actions/arquivos-6";

// Marco 6A — Contracheques: a Gestão coloca o PDF de cada funcionário; ele vê no app e a Gestão sabe quando abriu.
const OK: Record<string, string> = { enviado: "Contracheque publicado. O funcionário recebe aviso no celular (se ligou os avisos).", removido: "Contracheque retirado do app (fica guardado no histórico)." };
const ERRO: Record<string, string> = { "sem-arquivo": "Escolha o arquivo PDF antes de enviar.", "nao-pdf": "O arquivo precisa ser PDF.", grande: "Arquivo grande demais (máximo 6 MB).",
  competencia: "Mês inválido (não dá para publicar mês que ainda não chegou).", falhou: "Não foi possível enviar agora. Tente de novo." };
const dataHora = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export default async function ContrachequesPage({ searchParams }: { searchParams: Promise<{ competencia?: string; ok?: string; erro?: string }> }) {
  await requireCapability("admin:manage");
  if (!oficialLiberado4f()) notFound();
  const query = await searchParams, atual = mesAtual();
  const competencia = mesValido(query.competencia) && query.competencia! <= atual ? query.competencia! : mesAnterior(atual);
  const [pessoas, publicados] = await Promise.all([lerCpfs4f().catch(() => null), lerContracheques6a(competencia).catch(() => null)]);
  const porPessoa = new Map<string, NonNullable<typeof publicados>>();
  for (const c of publicados ?? []) porPessoa.set(c.employee_id, [...(porPessoa.get(c.employee_id) ?? []), c]);
  const link = (m: string) => `/contracheques?competencia=${m}`;
  const comAlgum = (pessoas ?? []).filter(p => porPessoa.has(p.employee_id)).length;
  return <>
    <PageHeader eyebrow="APP DO FUNCIONÁRIO · TESTE" title="Contracheques"
      description="Coloque o PDF do contracheque de cada funcionário. Ele vê no app (Meus contracheques) e você sabe quando ele abriu." />
    <nav className="espelho-mes" aria-label="Escolher mês">
      <Link className="button ghost" href={link(mesAnterior(competencia))} aria-label="Mês anterior"><ChevronLeft size={18} aria-hidden />Anterior</Link>
      <strong>{nomeDoMes(competencia)}</strong>
      {competencia < atual ? <Link className="button ghost" href={link(mesSeguinte(competencia))} aria-label="Próximo mês">Próximo<ChevronRight size={18} aria-hidden /></Link> : <span />}
    </nav>
    {query.ok && OK[query.ok] && <div className="alert success" role="status">{OK[query.ok]}</div>}
    {query.erro && <div className="alert error" role="alert">{ERRO[query.erro] ?? ERRO.falhou}</div>}
    {(!pessoas || !publicados) && <div className="alert error" role="alert">Não foi possível ler os dados agora. Tente de novo em instantes.</div>}
    <section className="panel">
      <header className="panel-header"><div><h2>{comAlgum} de {pessoas?.length ?? 0} com contracheque em {nomeDoMes(competencia).toLocaleLowerCase("pt-BR")}</h2>
        <p>Só PDF, até 6 MB. Mandar de novo o mesmo mês e tipo substitui o anterior.</p></div></header>
      <div className="data-table-wrap"><table className="data-table contracheque-tabela">
        <thead><tr><th>Funcionário</th><th>Publicado</th><th>Enviar PDF</th></tr></thead>
        <tbody>{(pessoas ?? []).map(p => { const lista = porPessoa.get(p.employee_id) ?? []; return <tr key={p.employee_id}>
          <td><span className="primary-cell">{p.full_name}</span><span className="secondary-cell">{p.registration_code ? `Matrícula ${p.registration_code}` : "Sem matrícula"}</span></td>
          <td>{!lista.length ? <span className="muted">—</span> : lista.map(c => <div key={c.id} className="contracheque-item">
            <a className="button ghost" href={`/arquivos/${c.arquivo_id}`} target="_blank" rel="noopener noreferrer"><FileText size={16} aria-hidden />{TIPOS_FOLHA[c.tipo_folha]}</a>
            <span className="secondary-cell">Em {dataHora(c.publicado_em)} · {c.visto_em ? `aberto pelo funcionário em ${dataHora(c.visto_em)}` : "ainda não abriu"}</span>
            <form action={removerContracheque6a}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="competencia" value={competencia} />
              <button className="button ghost" type="submit">Retirar do app</button></form>
          </div>)}</td>
          <td><form method="post" action="/contracheques/enviar" encType="multipart/form-data" className="inline-action contracheque-envio">
            <input type="hidden" name="competencia" value={competencia} /><input type="hidden" name="employeeId" value={p.employee_id} />
            <input type="file" name="arquivo" accept="application/pdf,.pdf" required aria-label={`PDF do contracheque de ${p.full_name}`} />
            <select name="tipoFolha" defaultValue="mensal" aria-label="Tipo da folha">{Object.entries(TIPOS_FOLHA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <button className="button secondary" type="submit"><Upload size={16} aria-hidden />Enviar</button></form></td>
        </tr>; })}</tbody>
      </table></div>
      <div className="panel-body"><p className="muted espelho-aviso">Teste sem valor oficial. Contracheque é dado pessoal (LGPD): só o próprio funcionário e o administrador abrem;
        o link para abrir vale 2 minutos. O recibo assinado ou o comprovante de depósito continuam valendo como prova de pagamento (CLT art. 464).</p></div>
    </section>
  </>;
}
