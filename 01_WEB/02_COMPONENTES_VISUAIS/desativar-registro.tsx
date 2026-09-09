import { OperationForm, type OperationAction } from "@/02_COMPONENTES_VISUAIS/formulario-operacao";
export function DeactivateRecord({ id, action, name }: { id: string; action: OperationAction; name: string }) {
  return <section className="panel"><header className="panel-header"><h2>Desativar cadastro</h2></header><div className="panel-body">
    <details><summary className="text-link">Desativar {name}</summary><OperationForm action={action} label="Confirmar desativação">
      <input type="hidden" name="id" value={id} />
      <p className="full">O cadastro sai da lista de ativos. O histórico permanece registrado.</p>
      <label className="checkbox-field full"><input type="checkbox" name="confirmation" required />Confirmo a desativação de {name}.</label>
    </OperationForm></details>
  </div></section>;
}
