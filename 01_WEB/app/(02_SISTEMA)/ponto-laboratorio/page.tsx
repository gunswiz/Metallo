import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { readPointManagement } from "@/05_ACESSO_A_DADOS/Ponto/ponto-gestao";
import { locationLabel } from "@/05_ACESSO_A_DADOS/Ponto/ponto-online";
import { pointDate, pointTime } from "@/03_FUNCOES_E_LOGICA/Ponto/relogio-referencia";
export default async function PointLabPage() {
  await requireCapability("admin:manage");
  const events = await readPointManagement();
  return <>
    <PageHeader eyebrow="SIMULAÇÃO SEM VALOR OFICIAL" title="Ponto · laboratório" description="Últimas 100 marcações sintéticas. Leitura exclusiva do administrador global ativo, sem mapa ou rastreamento." />
    <section className="panel"><div className="panel-body"><p>Coletor: navegador · online · Fortaleza (UTC−03:00). Precisão é contexto declarado pelo navegador e não comprova presença ou fraude.</p>
      {!events.length ? <p>Nenhuma marcação 4A confirmada.</p> : <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Funcionário</th><th>Marcação</th><th>Gravação</th><th>Localização</th><th>Precisão</th><th>Referência</th></tr></thead><tbody>{events.map(event => <tr key={event.event_id}><td>{event.employee_name}</td><td>{pointDate(event.marking_at)} {pointTime(event.marking_at)}</td><td>{pointDate(event.recorded_at)} {pointTime(event.recorded_at)}</td><td>{locationLabel[event.location_status]}</td><td>{event.accuracy_meters === null ? "Não disponível" : `${event.accuracy_meters} m`}</td><td>{event.synthetic_reference}</td></tr>)}</tbody></table></div>}
      <p>Coordenadas não são disponibilizadas à Gestão neste marco. Originais não podem ser editados nesta tela.</p><small>Não é produção, conformidade REP-P ou autorização de ponto oficial. Não liberado para funcionários reais. Não implantado no Supabase remoto. Não autoriza publicação.</small>
    </div></section>
  </>;
}
