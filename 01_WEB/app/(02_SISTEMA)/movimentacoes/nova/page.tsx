import Link from "next/link";
import { registerAssetMovement, registerMaterialMovement } from "@/app/actions/operations";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";
import { SubmitButton } from "@/02_COMPONENTES_VISUAIS/submit-button";

const errors: Record<string, string> = {
  "dados-invalidos": "Revise os campos da operação.",
  insufficient_stock: "A origem não possui estoque suficiente.",
  forbidden_role: "Seu perfil não pode executar essa operação.",
  forbidden_team: "A origem ou o destino está fora da sua equipe.",
  same_team_transfer: "Origem e destino precisam ser diferentes.",
  falha: "Não foi possível concluir. Os dados não foram alterados.",
};

export default async function NewMovementPage({ searchParams }: { searchParams: Promise<{ error?: string; asset?: string; item?: string; type?: string }> }) {
  await requireCapability("operations:write");
  const query = await searchParams;
  const service = await getMetalloService();
  const [teams, materials, assets] = await Promise.all([
    service.listTeams(),
    service.listMaterials({ page: 1, pageSize: 100, q: "" }),
    service.listAssets({ page: 1, pageSize: 100, q: "" }),
  ]);
  return (
    <>
      <PageHeader eyebrow="OPERAÇÃO ATÔMICA" title="Nova movimentação" description="As alterações de origem, destino e histórico são concluídas juntas no banco." />
      {query.error && <div className="alert error" role="alert">{errors[query.error] ?? errors.falha}</div>}
      <section className="content-grid">
        <div className="panel"><header className="panel-header"><div><h2>Material</h2><p>Entrada, saída, transferência, consumo ou reposição</p></div></header><div className="panel-body">
          <form action={registerMaterialMovement} className="form-grid">
            <label className="full">Material<select name="itemId" required defaultValue={query.item ?? ""}><option value="" disabled>Selecione</option>{materials.data.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}</select></label>
            <label>Operação<select name="movementType" defaultValue={query.type === "consumption" ? "consumption" : "transfer"}><option value="entry">Entrada</option><option value="exit">Saída</option><option value="transfer">Transferência</option><option value="return">Devolução</option><option value="consumption">Consumo</option><option value="replenishment">Reposição</option></select></label>
            <label>Quantidade<input name="quantity" type="number" min="1" defaultValue="1" required /></label>
            <label>Origem<select name="originTeamId" defaultValue=""><option value="">Externa / não se aplica</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
            <label>Destino<select name="destinationTeamId" defaultValue=""><option value="">Baixa / não se aplica</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
            <label className="full">Observação<textarea name="note" maxLength={500} /></label>
            <div className="form-actions"><SubmitButton pendingLabel="Registrando…">Confirmar movimentação</SubmitButton></div>
          </form>
        </div></div>
        <div className="panel"><header className="panel-header"><div><h2>Equipamento</h2><p>Transferência e mudança individual de situação</p></div></header><div className="panel-body">
          <form action={registerAssetMovement} className="form-grid">
            <label className="full">Patrimônio<select name="assetId" required defaultValue={query.asset ?? ""}><option value="" disabled>Selecione</option>{assets.data.map((asset) => <option key={asset.id} value={asset.id}>{asset.items?.name} · {asset.asset_code} · {asset.ownership_type === "rented" ? "Alugado" : "Próprio"}</option>)}</select></label>
            <label>Operação<select name="movementType" defaultValue="transfer"><option value="assign">Atribuir</option><option value="transfer">Transferir</option><option value="return">Devolver</option><option value="maintenance">Manutenção</option><option value="status_change">Alterar condição</option></select></label>
            <label>Nova situação<select name="newStatus" defaultValue="available"><option value="available">Disponível</option><option value="in_use">Em uso</option><option value="maintenance">Manutenção</option><option value="damaged">Danificado</option><option value="lost">Perdido</option><option value="retired">Baixado</option></select></label>
            <label className="full">Destino<select name="destinationTeamId" defaultValue=""><option value="">Sem equipe / devolução externa</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
            <label className="full">Observação<textarea name="note" maxLength={500} /></label>
            <div className="form-actions"><Link className="button ghost" href="/movimentacoes">Cancelar</Link><SubmitButton pendingLabel="Transferindo…">Confirmar transferência</SubmitButton></div>
          </form>
        </div></div>
      </section>
    </>
  );
}
