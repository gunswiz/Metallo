import Link from "next/link";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { readPointManagement } from "@/05_ACESSO_A_DADOS/Ponto/ponto-gestao";
import { locationLabel } from "@/05_ACESSO_A_DADOS/Ponto/ponto-online";
import { pointDate, pointTime } from "@/03_FUNCOES_E_LOGICA/Ponto/relogio-referencia";
import { diferencaTexto, textoConferir, TEXTO_SITUACAO_HORA } from "@/03_FUNCOES_E_LOGICA/Ponto/fila-offline-4k";
export default async function PointLabPage() {
  await requireCapability("admin:manage");
  const { events, integrity, online, officialTime } = await readPointManagement();
  const conferir = events.filter(e => e.review);
  return <>
    <PageHeader eyebrow="SIMULAÇÃO SEM VALOR OFICIAL" title={online ? "Ponto · teste online" : "Ponto · laboratório"} description="Últimas 100 marcações de teste. Leitura exclusiva do administrador global ativo, sem mapa ou rastreamento." actions={online ? <><Link className="button primary" href="/ponto-laboratorio/espelho">Espelho de ponto do mês</Link><Link className="button secondary" href="/ponto-laboratorio/oficial">Empresa, CPF e AFD</Link></> : undefined} />
    <section className="panel"><div className="panel-body">{integrity && <p role="status"><strong>{integrity.ok ? `Integridade conferida agora: ${integrity.total} marcações, NSR sem buracos e cadeia de hash íntegra.` : `ALERTA DE INTEGRIDADE: ${integrity.reason ?? "verificação falhou"}.`}</strong></p>}{officialTime && <p role="status"><strong>Hora oficial: {TEXTO_SITUACAO_HORA[officialTime.situacao]}{officialTime.conferido_em ? ` — conferida às ${pointTime(officialTime.conferido_em)} com o NTP.br, diferença de ${diferencaTexto(officialTime.diferenca_ms)}` : ""}.</strong>{!officialTime.valida && " A conferência está atrasada ou fora do limite: verifique."} <Link href="/ponto-laboratorio/oficial#hora">Ver histórico</Link></p>}
      {conferir.length > 0 && <p className="alert warn" role="alert"><strong>{conferir.length} marcação(ões) feita(s) sem internet para conferir.</strong> A hora não foi alterada; veja o motivo na tabela e confirme com o funcionário.</p>}
      <p>Coletor: navegador · com ou sem internet (marcações sem internet são enviadas quando a conexão volta) · Fortaleza (UTC−03:00). Precisão é contexto declarado pelo navegador e não comprova presença ou fraude.</p>
      {!events.length ? <p>Nenhuma marcação confirmada.</p> : <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Funcionário</th><th>Marcação</th><th>Gravação</th><th>Internet</th><th>Localização</th><th>Precisão</th><th>Referência</th></tr></thead><tbody>{events.map(event => <tr key={event.event_id}><td>{event.employee_name}</td><td>{pointDate(event.marking_at)} {pointTime(event.marking_at)}</td><td>{pointDate(event.recorded_at)} {pointTime(event.recorded_at)}</td><td>{event.online ? "Com internet" : <>Sem internet{event.review ? <><br/><span className="status-badge warn">Conferir</span> <small>{textoConferir(event.review_reasons ?? [])}</small></> : null}</>}</td><td>{locationLabel[event.location_status]}</td><td>{event.accuracy_meters === null ? "Não disponível" : `${event.accuracy_meters} m`}</td><td>{event.synthetic_reference}</td></tr>)}</tbody></table></div>}
      <p>Coordenadas não são disponibilizadas à Gestão neste marco. Originais não podem ser editados nesta tela.</p><small>Não é produção, conformidade REP-P ou autorização de ponto oficial. Não liberado para funcionários reais.{online ? " Ambiente de teste online com dados fictícios." : " Não implantado no Supabase remoto. Não autoriza publicação."}</small>
    </div></section>
  </>;
}
