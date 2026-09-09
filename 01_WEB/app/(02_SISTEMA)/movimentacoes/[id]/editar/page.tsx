import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { movementLabel, statusLabel } from "@metallo/core";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { getMovementForEdit } from "@/05_ACESSO_A_DADOS/Repositorios/historico-operacoes-repository";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { OperationForm } from "@/02_COMPONENTES_VISUAIS/formulario-operacao";
import { editHistory, removeHistory } from "@/app/actions/administracao-completa";
export default async function EditMovementPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kind?: string }> }) {
  await requireCapability("admin:manage");
  const { id } = await params;
  const kind = z.enum(["material", "equipment"]).catch("material").parse((await searchParams).kind);
  if (!z.uuid().safeParse(id).success) notFound();
  const [movement, teams] = await Promise.all([getMovementForEdit(id, kind), (await getMetalloService()).listTeams()]);
  if (!movement) notFound();
  return <><PageHeader eyebrow="CORREÇÃO ADMINISTRATIVA" title={movement.name} description={`${movementLabel(movement.movementType)} · A correção usa as mesmas regras do aplicativo e pode ajustar os saldos relacionados.`} actions={<Link className="button ghost" href={`/movimentacoes?kind=${kind}`}>Voltar</Link>} />
    <section className="panel"><div className="panel-body"><OperationForm action={editHistory} label="Salvar correção">
      <input type="hidden" name="id" value={id} /><input type="hidden" name="kind" value={kind} />
      {kind === "material" && <><label>Quantidade<input name="quantity" type="number" min={1} max={1_000_000} required defaultValue={movement.quantity} /></label><label>Origem<select name="originTeamId" defaultValue={movement.originTeamId ?? ""}><option value="">Externo</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label></>}
      <label>Destino<select name="destinationTeamId" defaultValue={movement.destinationTeamId ?? ""} required={kind === "equipment"}><option value="">{kind === "material" ? "Baixa" : "Selecione"}</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
      {kind === "equipment" && <label>Situação<select name="status" defaultValue={movement.status}>{["available", "in_use", "maintenance", "damaged", "lost", "retired"].map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>}
      <label className="full">Observação<textarea name="note" maxLength={500} defaultValue={movement.note ?? ""} /></label>
    </OperationForm></div></section>
    <section className="panel"><header className="panel-header"><h2>Excluir movimentação</h2></header><div className="panel-body"><details><summary className="text-link">Revisar exclusão</summary><OperationForm action={removeHistory} label="Excluir movimentação">
      <input type="hidden" name="id" value={id} /><input type="hidden" name="kind" value={kind} />
      <p className="full">Esta operação remove o registro e aplica as regras de correção de saldo do banco. Confira o registro antes de continuar.</p>
      <label className="checkbox-field full"><input name="confirmation" type="checkbox" required />Confirmo a exclusão desta movimentação.</label>
    </OperationForm></details></div></section>
  </>;
}
