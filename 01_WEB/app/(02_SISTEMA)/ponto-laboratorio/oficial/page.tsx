import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { MENSAGENS_4F, mostrarCnpj } from "@/03_FUNCOES_E_LOGICA/Ponto/oficial-4f";
import { mesAtual } from "@/03_FUNCOES_E_LOGICA/Ponto/espelho-4e";
import { lerCpfs4f, lerEmpresa4f, lerFeriados4h, lerJornada4g, oficialLiberado4f } from "@/05_ACESSO_A_DADOS/Ponto/oficial-4f";
import { horasMinutos, minutosPrevistos } from "@/03_FUNCOES_E_LOGICA/Ponto/espelho-4e";
import { removerFeriado4h, salvarCpf4f, salvarEmpresa4f, salvarFeriado4h, salvarJornada4g } from "@/app/actions/ponto-oficial";

// Marco 4F — o que o ponto precisa para virar oficial: empresa, CPF de cada funcionário e o arquivo AFD (prévia).
export default async function PontoOficialPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requireCapability("admin:manage");
  if (!oficialLiberado4f()) redirect("/ponto-laboratorio");
  const query = await searchParams;
  const ano = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza", year: "numeric" }).format(new Date());
  const [empresa, pessoas, jornada, feriados] = await Promise.all([lerEmpresa4f(), lerCpfs4f(), lerJornada4g(), lerFeriados4h(`${ano}-01-01`, `${ano}-12-31`)]);
  const semanal = Object.values(jornada).reduce((t, h) => t + minutosPrevistos(h), 0);
  const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
  const semCpf = pessoas.filter(p => !p.cpf_mascarado).length;
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());
  return <>
    <PageHeader eyebrow="PONTO · TESTE SEM VALOR OFICIAL" title="Dados do ponto oficial"
      description="Empresa, CPF de cada funcionário e o arquivo AFD para a fiscalização (Portaria 671). Tudo aqui é teste, com dados fictícios."
      actions={<><Link className="button ghost" href="/ponto-laboratorio">Ver marcações</Link><Link className="button ghost" href="/ponto-laboratorio/espelho">Espelho de ponto</Link></>} />
    {query.ok && <div className="alert success" role="status">{({ empresa: "Dados da empresa salvos.", jornada: "Jornada salva.", feriado: "Feriado salvo.", "feriado-removido": "Feriado retirado." } as Record<string, string>)[query.ok] ?? "CPF salvo."}</div>}
    {query.erro && <div className="alert error" role="alert">{MENSAGENS_4F[query.erro] ?? MENSAGENS_4F.falhou}</div>}

    <section className="panel" aria-labelledby="empresa-titulo">
      <header className="panel-header"><div><h2 id="empresa-titulo">1. Empresa (empregador)</h2><p>Vai no cabeçalho do AFD. Hoje: empresa fictícia de teste.</p></div></header>
      <div className="panel-body"><form action={salvarEmpresa4f} className="form-grid">
        <label>CNPJ (ou CPF, se for pessoa física)<input name="documento" required inputMode="numeric" maxLength={18} defaultValue={empresa ? (empresa.documento.length === 14 ? mostrarCnpj(empresa.documento) : empresa.documento) : ""} /></label>
        <label className="full">Razão social<input name="razao" required maxLength={150} defaultValue={empresa?.razao_social ?? ""} /></label>
        <label className="full">Local de prestação do serviço<input name="local" required maxLength={100} defaultValue={empresa?.local_prestacao ?? ""} /></label>
        <label>CNO ou CAEPF (se tiver)<input name="cno" inputMode="numeric" maxLength={14} defaultValue={empresa?.cno_caepf ?? ""} /></label>
        <label>Registro do programa no INPI<input name="inpi" inputMode="numeric" maxLength={17} defaultValue={empresa?.inpi ?? ""} placeholder="Ainda não registrado" />
          <small className="field-hint">Sem o registro no INPI o ponto não pode ser oficial (REP-P).</small></label>
        <label>CNPJ do desenvolvedor do programa<input name="desenvolvedor" inputMode="numeric" maxLength={18} defaultValue={empresa?.desenvolvedor_documento ?? ""} /></label>
        <div className="form-actions"><button className="button primary" type="submit">Salvar empresa</button></div>
      </form></div>
    </section>

    <section className="panel" id="cpf" aria-labelledby="cpf-titulo">
      <header className="panel-header"><div><h2 id="cpf-titulo">2. CPF dos funcionários</h2>
        <p>Sem CPF a pessoa não consegue marcar o ponto. Por segurança, o CPF aparece só em parte (***.456.789-**). {semCpf ? `${semCpf} pessoa(s) sem CPF.` : "Todos com CPF."}</p></div></header>
      <div className="data-table-wrap"><table className="data-table cpf-tabela">
        <thead><tr><th>Funcionário</th><th>CPF</th><th>Alterar</th></tr></thead>
        <tbody>{pessoas.map(p => <tr key={p.employee_id}>
          <td><span className="primary-cell">{p.full_name}</span><span className="secondary-cell">{p.registration_code ?? "Sem matrícula"}</span></td>
          <td>{p.cpf_mascarado ?? <span className="status-badge warn">Sem CPF</span>}</td>
          <td><form action={salvarCpf4f} className="inline-action"><input type="hidden" name="employeeId" value={p.employee_id} />
            <input name="cpf" inputMode="numeric" maxLength={14} autoComplete="off" placeholder="000.000.000-00" aria-label={`Novo CPF de ${p.full_name}`} />
            <button className="button secondary" type="submit">Salvar</button></form></td>
        </tr>)}</tbody>
      </table></div>
      <div className="panel-body"><p className="muted">Deixe em branco e salve para remover. Toda troca fica registrada (só os 2 últimos números).</p></div>
    </section>

    <section className="panel" id="jornada" aria-labelledby="jornada-titulo">
      <header className="panel-header"><div><h2 id="jornada-titulo">3. Jornada (horário da empresa)</h2>
        <p>Igual para todas as funções. Total: <strong>{horasMinutos(semanal)} por semana</strong>. Usada no espelho (saldo do dia) e no AEJ. Deixe em branco o dia sem trabalho.</p></div></header>
      <form action={salvarJornada4g}>
        <div className="data-table-wrap"><table className="data-table jornada-tabela">
          <thead><tr><th>Dia</th><th>Entrada</th><th>Saída (almoço)</th><th>Volta</th><th>Saída</th><th>Horas</th></tr></thead>
          <tbody>{DIAS.map((nome, i) => { const h = jornada[String(i + 1)] ?? []; return <tr key={nome}><th scope="row">{nome}</th>
            {[0, 1, 2, 3].map(n => <td key={n}><input type="time" name={`d${i + 1}_${n + 1}`} defaultValue={h[n] ?? ""} aria-label={`${nome}, horário ${n + 1}`} /></td>)}
            <td className="numeric">{h.length ? horasMinutos(minutosPrevistos(h)) : "Folga"}</td></tr>; })}</tbody>
        </table></div>
        <div className="panel-body"><button className="button primary" type="submit">Salvar jornada</button>
          <p className="muted">Tolerância da CLT (art. 58 §1º): até 5 minutos por marcação, no máximo 10 no dia, não contam. Passou disso, conta tudo. Convenção coletiva pode mudar regras — conferir com o DP.</p></div>
      </form>
    </section>

    <section className="panel" id="feriados" aria-labelledby="feriados-titulo">
      <header className="panel-header"><div><h2 id="feriados-titulo">4. Feriados de {ano}</h2>
        <p>Os nacionais já estão cadastrados. Inclua os do estado e da cidade de cada obra (ex.: Data Magna do Ceará) e os dias que a empresa liberar.</p></div></header>
      <div className="data-table-wrap"><table className="data-table feriados-tabela">
        <thead><tr><th>Data</th><th>Feriado</th><th>Tipo</th><th></th></tr></thead>
        <tbody>{feriados.map(f => <tr key={f.data}>
          <td><strong>{f.data.slice(8)}/{f.data.slice(5, 7)}</strong> <span className="secondary-cell">{new Date(`${f.data}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", "")}</span></td>
          <td>{f.nome}</td><td>{{ nacional: "Nacional", estadual: "Estadual", municipal: "Municipal", empresa: "Da empresa" }[f.tipo]}</td>
          <td><form action={removerFeriado4h}><input type="hidden" name="data" value={f.data} /><button className="button ghost" type="submit" aria-label={`Retirar feriado ${f.nome}`}>Retirar</button></form></td>
        </tr>)}</tbody>
      </table></div>
      <div className="panel-body"><form action={salvarFeriado4h} className="form-grid">
        <label>Data<input type="date" name="data" required /></label>
        <label>Nome do feriado<input name="nome" required maxLength={80} placeholder="Ex.: Data Magna do Ceará" /></label>
        <label>Tipo<select name="tipo" defaultValue="estadual"><option value="estadual">Estadual</option><option value="municipal">Municipal</option><option value="empresa">Da empresa</option><option value="nacional">Nacional</option></select></label>
        <div className="form-actions"><button className="button primary" type="submit">Incluir feriado</button></div>
      </form></div>
    </section>

    <section className="panel" id="afd" aria-labelledby="afd-titulo">
      <header className="panel-header"><div><h2 id="afd-titulo">5. Arquivos para a fiscalização e a folha (prévia)</h2>
        <p><strong>AFD</strong> (versão 004): as marcações originais com CPF, NSR e código de cada registro — é o que a fiscalização pede.
          <strong> AEJ</strong> (versão 002): a jornada tratada (entradas, saídas e horário contratual) — é o que vai para a folha.</p></div></header>
      <div className="panel-body">
        <form method="get" action="/ponto-laboratorio/afd" className="form-grid">
          <label>De<input type="date" name="de" required defaultValue={`${mesAtual()}-01`} max={hoje} /></label>
          <label>Até<input type="date" name="ate" required defaultValue={hoje} max={hoje} /></label>
          <div className="form-actions"><button className="button primary" type="submit" name="tipo" value="afd"><Download size={16} aria-hidden />Baixar AFD</button>
            <button className="button secondary" type="submit" name="tipo" value="aej"><Download size={16} aria-hidden />Baixar AEJ</button></div>
        </form>
        <p className="muted espelho-aviso"><strong>Ainda não é o arquivo oficial:</strong> falta o registro do programa no INPI, a assinatura digital (.p7s, certificado ICP-Brasil)
          e os registros de cadastro da empresa e dos funcionários (tipos 2 e 5) na mesma numeração. Marcações antigas, feitas antes do CPF, ficam fora do arquivo.
          No AEJ, o registro 07 traz os domingos (descanso semanal), as faltas não justificadas e as folgas no lugar de feriado lançadas no espelho; banco de horas ainda não.</p>
      </div>
    </section>
  </>;
}
