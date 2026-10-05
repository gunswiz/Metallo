import Link from "next/link";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { SubmitButton } from "@/02_COMPONENTES_VISUAIS/submit-button";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";
import { criarObra } from "@/app/actions/obras";

const erros: Record<string, string> = {
  dados: "Confira o nome da obra (de 2 a 100 letras).",
  "escolha-equipe": "Escolha qual equipe vai guardar o estoque da obra.",
  equipe: "Não foi possível criar a equipe. Confira o nome e tente de novo.",
  obra: "Não foi possível cadastrar a obra. A equipe escolhida pode já estar em outra obra.",
  "obra-equipe-criada": "A equipe foi criada, mas a obra não. Tente de novo escolhendo “Usar uma equipe que já existe”.",
};

// Marco 3N: cadastro de obra num lugar fácil de achar, com a equipe criada junto quando precisar.
export default async function NovaObraPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  await requireCapability("admin:manage");
  const { erro } = await searchParams;
  const data = await (await getMetalloService()).siteSnapshot();
  const livres = data.teams.filter(team => !team.worksite_id && !team.central);
  return <>
    <PageHeader eyebrow="OBRAS E RELATÓRIOS" title="Nova obra" description="Cadastre a obra e diga quem guarda o material e os EPIs dela." />
    {erro && <div className="alert error" role="alert">{erros[erro] ?? erros.obra}</div>}
    <section className="panel nova-obra"><div className="panel-body">
      <form action={criarObra} className="form-stack">
        <label>Nome da obra<input name="nome" required minLength={2} maxLength={100} placeholder="Ex.: Galpão Norte" autoComplete="off" /></label>
        <fieldset className="nova-obra-escolha">
          <legend>Quem guarda o material e os EPIs desta obra?</legend>
          <label className="nova-obra-opcao"><input type="radio" name="estoque" value="nova" defaultChecked />
            <span><strong>Criar uma equipe nova para esta obra</strong><small>O mais comum. A equipe nasce junto e já fica ligada à obra.</small></span></label>
          <label className="nova-obra-sub">Nome da equipe (opcional)<input name="equipe" maxLength={100} placeholder="Se deixar em branco: Equipe + nome da obra" autoComplete="off" /></label>
          <label className="nova-obra-opcao"><input type="radio" name="estoque" value="existente" disabled={livres.length === 0} />
            <span><strong>Usar uma equipe que já existe</strong><small>{livres.length === 0 ? "Todas as equipes já estão em alguma obra." : "Só aparecem equipes que ainda não estão em nenhuma obra."}</small></span></label>
          {livres.length > 0 && <label className="nova-obra-sub">Equipe<select name="equipeId" defaultValue=""><option value="">Selecione</option>
            {livres.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>}
        </fieldset>
        <p className="muted">Depois você pode juntar mais equipes à obra em Obras › “Vincular mais uma equipe à obra”. Tudo fica no histórico.</p>
        <div className="form-actions"><Link className="button ghost" href="/obras">Cancelar</Link><SubmitButton pendingLabel="Cadastrando…">Cadastrar obra</SubmitButton></div>
      </form>
    </div></section>
  </>;
}
