import Link from "next/link";
import { notFound } from "next/navigation";
import { randomInt } from "node:crypto";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { SubNav } from "@/02_COMPONENTES_VISUAIS/sidebar-nav";
import { SubmitButton } from "@/02_COMPONENTES_VISUAIS/submit-button";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { errosAcesso3o, listaAcesso3o, sugerirSenha3o, sugerirUsuario3o, type FuncionarioAcesso3o } from "@/03_FUNCOES_E_LOGICA/Acesso/acesso-app-3o";
import { createClient } from "@/05_ACESSO_A_DADOS/Supabase/server";
import { getSupabaseEnv } from "@/09_CONFIGURACOES/ambienteSupabase";
import { recursosNovosLiberados } from "@/09_CONFIGURACOES/ambiente-teste-online";
import { alterarAcessoApp } from "@/app/actions/acesso-app";

const APP_URL = "https://metallo-teste-colaborador.metallo-gunswiz.workers.dev";
const filtros = [["todos", "Todos"], ["sem_acesso", "Sem acesso"], ["ativo", "Com acesso"], ["bloqueado", "Bloqueados"]] as const;
const rotulo: Record<FuncionarioAcesso3o["situacao"], [string, string]> = {
  ativo: ["Com acesso", "good"], sem_acesso: ["Sem acesso", "warn"], bloqueado: ["Bloqueado", "bad"],
};
const data = (valor: string | null) => valor ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", dateStyle: "short", timeStyle: "short" }).format(new Date(valor)) : "nunca";

// Marco 3O: a Gestão cria o login do funcionário no app, troca a senha e bloqueia quando ele sai.
export default async function AcessoAppPage({ searchParams }: { searchParams: Promise<{ filtro?: string; q?: string; ok?: string; erro?: string; f?: string }> }) {
  const profile = await requireCapability("admin:manage");
  if (!recursosNovosLiberados(getSupabaseEnv().url)) notFound();
  const query = await searchParams;
  const supabase = await createClient();
  const resposta = await supabase.functions.invoke("acesso-funcionario", { body: { acao: "listar" } });
  const lido = listaAcesso3o.safeParse(resposta.data);
  const todos = lido.success ? lido.data.funcionarios : [];
  const filtro = filtros.some(([id]) => id === query.filtro) ? query.filtro! : "todos";
  const termo = (query.q ?? "").trim().toLocaleLowerCase("pt-BR");
  const lista = todos.filter(item => (filtro === "todos" || item.situacao === filtro) && (!termo || item.nome.toLocaleLowerCase("pt-BR").includes(termo)));
  const conta = (situacao: string) => todos.filter(item => item.situacao === situacao).length;
  const alvo = todos.find(item => item.employee_id === query.f);
  return <>
    <PageHeader eyebrow="PESSOAS" title="Acesso ao app" description="Crie o login de cada funcionário no app, troque a senha quando ele esquecer e bloqueie quando ele sair da empresa." />
    <SubNav profile={profile} grupo="pessoas"/>
    {!lido.success && <div className="alert error" role="alert">Não foi possível carregar a lista agora. Atualize a página.</div>}
    {query.erro && <div className="alert error" role="alert">{errosAcesso3o[query.erro] ?? errosAcesso3o.falha}</div>}
    {query.ok === "criar" && alvo && <div className="alert success" role="status">
      Acesso criado para <strong>{alvo.nome}</strong>. Entregue a ele: usuário <strong>{alvo.usuario}</strong> e a senha que você escreveu. Ele entra em {APP_URL.replace("https://", "")}.</div>}
    {query.ok === "nova_senha" && alvo && <div className="alert success" role="status">Senha trocada para <strong>{alvo.nome}</strong>. Os aparelhos em que ele estava conectado saíram.</div>}
    {query.ok === "bloquear" && alvo && <div className="alert success" role="status">Acesso de <strong>{alvo.nome}</strong> bloqueado. O histórico dele continua guardado.</div>}
    <section className="panel consumo-filtros"><div className="panel-body">
      <nav className="chip-row" aria-label="Situação">{filtros.map(([id, label]) =>
        <Link key={id} className={filtro === id ? "chip active" : "chip"} aria-current={filtro === id ? "true" : undefined}
          href={`/acesso-app?filtro=${id}${termo ? `&q=${encodeURIComponent(termo)}` : ""}`}>{label} ({id === "todos" ? todos.length : conta(id)})</Link>)}</nav>
      <form method="get" className="filter-row" style={{ marginTop: 12 }}><input type="hidden" name="filtro" value={filtro}/>
        <label>Procurar funcionário<input type="search" name="q" defaultValue={query.q ?? ""} placeholder="Nome"/></label>
        <button className="button secondary" type="submit">Procurar</button></form>
    </div></section>
    <section className="panel"><div className="data-table-wrap"><table className="data-table acesso-tabela">
      <thead><tr><th>Funcionário</th><th>Situação</th><th>Usuário</th><th>Último acesso</th><th>O que fazer</th></tr></thead>
      <tbody>{lista.map(item => <tr key={item.employee_id}>
        <td><span className="primary-cell">{item.nome}</span><span className="secondary-cell">{item.matricula ? `Matrícula ${item.matricula}` : "Sem matrícula"} · {item.equipe ?? "Sem equipe"}</span></td>
        <td><span className={`status-badge ${rotulo[item.situacao][1]}`}>{rotulo[item.situacao][0]}</span></td>
        <td>{item.usuario ?? "—"}</td>
        <td>{item.situacao === "sem_acesso" ? "—" : data(item.ultimo_acesso)}</td>
        <td>{item.situacao === "ativo" ? <div className="acesso-acoes">
          <details className="operation-details"><summary>Nova senha</summary>
            <form action={alterarAcessoApp} className="form-grid">
              <input type="hidden" name="acao" value="nova_senha"/><input type="hidden" name="employee_id" value={item.employee_id}/>
              <label>Senha nova (anote para entregar)<input name="senha" type="text" minLength={8} maxLength={72} required autoComplete="off" defaultValue={sugerirSenha3o(randomInt)}/></label>
              <div className="form-actions"><SubmitButton pendingLabel="Trocando…">Trocar senha</SubmitButton></div>
            </form></details>
          <details className="operation-details"><summary>Bloquear acesso</summary>
            <form action={alterarAcessoApp} className="form-grid">
              <input type="hidden" name="acao" value="bloquear"/><input type="hidden" name="employee_id" value={item.employee_id}/>
              <label>Motivo<select name="motivo" defaultValue="employment_ended" required>
                <option value="employment_ended">Saiu da empresa</option><option value="account_replaced">Vai receber outro login</option>
                <option value="wrong_association">Login ligado à pessoa errada</option><option value="other">Outro motivo</option></select></label>
              <p className="full muted">Ele sai do app na hora. O histórico (ponto, EPI) continua guardado.</p>
              <div className="form-actions"><SubmitButton className="button danger" pendingLabel="Bloqueando…">Bloquear</SubmitButton></div>
            </form></details>
        </div> : !item.matricula ? <Link className="button ghost" href={`/funcionarios/${item.employee_id}`}>Cadastrar matrícula primeiro</Link> :
          <details className="operation-details" open={query.f === item.employee_id && Boolean(query.erro)}><summary>{item.situacao === "bloqueado" ? "Criar novo acesso" : "Criar acesso"}</summary>
            <form action={alterarAcessoApp} className="form-grid">
              <input type="hidden" name="acao" value="criar"/><input type="hidden" name="employee_id" value={item.employee_id}/>
              <label>Usuário<input name="usuario" required minLength={3} maxLength={30} pattern="[a-z][a-z0-9.]{2,29}" autoComplete="off" defaultValue={sugerirUsuario3o(item.nome)}/></label>
              <label>Senha (anote para entregar)<input name="senha" type="text" minLength={8} maxLength={72} required autoComplete="off" defaultValue={sugerirSenha3o(randomInt)}/></label>
              <p className="full muted">Confira a identidade do funcionário pessoalmente antes de entregar o login.</p>
              <div className="form-actions"><SubmitButton pendingLabel="Criando…">Criar acesso</SubmitButton></div>
            </form></details>}
        </td>
      </tr>)}{lista.length === 0 && <tr><td colSpan={5}>Ninguém nesta situação.</td></tr>}</tbody>
    </table></div></section>
  </>;
}
