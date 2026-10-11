import Link from "next/link";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { BotaoImprimir } from "@/02_COMPONENTES_VISUAIS/botao-imprimir";
import { requireProfile } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { GUIA_FUNCIONARIO, partesDestaque } from "@/03_FUNCOES_E_LOGICA/Guia/guia-funcionario";
import { getSupabaseEnv } from "@/09_CONFIGURACOES/ambienteSupabase";
import { TESTE_ONLINE_COLABORADOR_ORIGIN, TESTE_ONLINE_SUPABASE_URL } from "@/09_CONFIGURACOES/ambiente-teste-online";

// Marco 8A (Bloco 5) — folha para imprimir e entregar ao funcionário junto com o login. Mesmo texto do guia do app.
function Texto({ texto }: { texto: string }) {
  return <>{partesDestaque(texto).map((p, i) => p.destaque ? <strong key={i}>{p.texto}</strong> : <span key={i}>{p.texto}</span>)}</>;
}

export default async function GuiaFuncionarioPage() {
  await requireProfile();
  const endereco = getSupabaseEnv().url === TESTE_ONLINE_SUPABASE_URL ? `${TESTE_ONLINE_COLABORADOR_ORIGIN}/colaborador/login` : null;
  return <>
    <PageHeader eyebrow="GUIA DO METALLO" title="Guia do app do funcionário"
      description="Folha simples para imprimir e entregar junto com o login. É o mesmo passo a passo que o funcionário vê no app, em Menu › Como usar o app."
      actions={<><Link className="button ghost nao-imprimir" href="/ajuda">Voltar ao guia</Link><BotaoImprimir rotulo="Imprimir a folha" /></>} />
    <article className="guia-folha">
      <header><h2>Metallo · Como usar o app do funcionário</h2>
        <p className="guia-folha-acesso">Endereço do app: <strong>{endereco ?? "_____________________________________________"}</strong></p>
        <p className="guia-folha-acesso">Seu usuário: <strong>______________________</strong> &nbsp; A senha o escritório entrega à parte.</p></header>
      {GUIA_FUNCIONARIO.map(t => <section key={t.id} className="guia-folha-topico">
        <h3>{t.titulo}</h3>
        <p className="muted">{t.resumo}</p>
        <ol>{t.passos.map((p, i) => <li key={i}><Texto texto={p.texto} /></li>)}</ol>
        {t.dicas?.length ? <p className="guia-folha-dica"><strong>Bom saber:</strong> {t.dicas.join(" ")}</p> : null}
      </section>)}
      <footer><p>Dúvida? Fale com o escritório. Ninguém do escritório pede a sua senha. No app, toque em Menu › Como usar o app para ouvir a explicação.</p></footer>
    </article>
  </>;
}
