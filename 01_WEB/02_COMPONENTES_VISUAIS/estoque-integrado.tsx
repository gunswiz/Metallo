"use client";
import { can } from "@metallo/core";
import type { SessionProfile } from "@metallo/types";
import type { SiteSnapshot } from "@/03_FUNCOES_E_LOGICA/operacoesObra";
import type { SubmitOperation } from "./formulario-obra";
import { MaterialOperations, EquipmentOperations, IntegratedDelivery, ReceivingForm } from "./operacoes-integradas";
import { SiteEpiStockForms } from "./estoque-epi-obra";
import { siteFields } from "./ObrasEPedidos/campos";

export function StockWorkspace({data,profile,submit}:{data:SiteSnapshot;profile:SessionProfile;submit:SubmitOperation}){
  const {teamName,workName,allowedTeams}=siteFields(data,profile);
  return <>
    <section className="panel"><header className="panel-header"><div><h2>Estoque por obra / local</h2><p>O saldo físico é único. A equipe que consome continua identificada no lançamento.</p></div></header><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Local</th><th>Material</th><th>Saldo e medida</th></tr></thead><tbody>{data.materials.flatMap(item=>item.stock.map(stock=><tr key={item.id+"-"+stock.team_id}><td>{data.works.find(work=>work.stock_team_id===stock.team_id)?.name??teamName(stock.team_id)}</td><td>{item.name}</td><td>{stock.quantity} {item.unit}</td></tr>))}</tbody></table></div></section>
    {(can(profile,"consumption:write")||can(profile,"materials:write"))&&<MaterialOperations data={data} profile={profile} submit={submit}/>}
    <ReceivingForm data={data} profile={profile} submit={submit}/>
    {can(profile,"equipment:write")&&<EquipmentOperations data={data} profile={profile} submit={submit}/>}
    {can(profile,"epi:write")&&<>
      <IntegratedDelivery data={data} profile={profile} submit={submit}/>
      <SiteEpiStockForms data={data} teams={allowedTeams} submit={submit} transferOnly/>
      <section className="panel"><header className="panel-header"><h2>Lotes de EPI por local</h2></header><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Local</th><th>Item</th><th>Variante / C.A.</th><th>Saldo</th></tr></thead><tbody>{data.batches.map(batch=><tr key={batch.id}><td>{workName(batch.worksite_id)}</td><td>{data.epi_items.find(item=>item.id===batch.item_id)?.name}</td><td>{batch.variant??"Única"} · {batch.ca_number??"C.A. não informado"}</td><td>{batch.quantity} {data.epi_items.find(item=>item.id===batch.item_id)?.unit??"un"}</td></tr>)}</tbody></table></div></section>
    </>}
  </>;
}
