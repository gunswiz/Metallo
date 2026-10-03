"use client";

import { useState } from "react";
import { can, canOperateTeam } from "@metallo/core";
import type { SessionProfile } from "@metallo/types";
import type { SiteSnapshot } from "@/03_FUNCOES_E_LOGICA/operacoesObra";
import { SiteOperationForm, type OperationField, type SubmitOperation } from "./formulario-obra";
import { siteFields } from "./ObrasEPedidos/campos";
import { BatchDeliveryForm } from "./entrega-lote-form";
import { EpiDeliveryForm } from "./epi-delivery-form";

type Props = { data: SiteSnapshot; profile: SessionProfile; submit: SubmitOperation; initialItem?: string; initialAsset?: string; initialEmployee?: string; initialType?: string };

export function OrderReceipt({ order, line, submit }: { order: SiteSnapshot["orders"][number]; line: SiteSnapshot["orders"][number]["lines"][number]; submit: SubmitOperation }) {
  const remaining = line.quantity - line.received_quantity;
  if (remaining <= 0) return <p className="alert success">Recebimento concluído.</p>;
  const extra: OperationField[] = line.kind === "rental" ? [
    { name: "rental_company", label: "Locadora" },
    { name: "asset_codes", label: "Número de cada máquina (um por linha)", type: "textarea", required: true },
  ] : line.kind === "epi" ? [
    { name: "ca_number", label: "C.A. (obrigatório para EPI)", required: false },
    { name: "brand_model", label: "Marca / modelo", required: false },
    { name: "lot_number", label: "Lote", required: false },
  ] : [];
  return <SiteOperationForm title="Confirmar o que chegou" command="receive_order" fixed={{ order_id: order.id, line_id: line.id }} submit={submit}
    fields={[{ name: "quantity", label: "Quantidade recebida · " + remaining + " faltantes", type: "number", value: "1", max: remaining }, ...extra, { name: "note", label: "Observação", type: "textarea", required: false }]}>
    <p className="full muted">Uma confirmação atualiza o pedido e dá entrada no estoque. Não registre esta chegada novamente como entrada sem pedido.</p>
  </SiteOperationForm>;
}

export function ReceivingForm({ data, profile, submit, initialItem }: Props) {
  const [source, setSource] = useState("order");
  const [kind, setKind] = useState(initialItem && data.epi_items.some(item=>item.id===initialItem) ? "epi" : can(profile, "materials:write") ? "material" : "epi");
  const [selectedLine, setSelectedLine] = useState("");
  const { allowedTeams, teamField, quantity, note, teamName } = siteFields(data, profile);
  const receivable = data.orders.filter(order => ["ordered", "partial"].includes(order.status) && canOperateTeam(profile, order.team_id)).flatMap(order => order.lines.filter(line =>
    line.quantity > line.received_quantity && can(profile, line.kind === "rental" ? "rentals:write" : "requests:write")).map(line => ({ order, line })));
  const chosen = receivable.find(entry => entry.line.id === selectedLine);
  const directMaterial = can(profile, "materials:write"), directEpi = can(profile, "epi:write");
  return <section className="panel">
    <header className="panel-header"><div><h2>Receber itens</h2><p>Identifique a chegada para atualizar o estoque uma única vez.</p></div></header>
    <div className="panel-body">
      <label>Origem do recebimento<select value={source} onChange={event => setSource(event.target.value)}>
        <option value="order">Pedido já cadastrado</option>
        {(directMaterial || directEpi) && <option value="direct">Entrada sem pedido</option>}
      </select></label>
      {source === "order" ? <>
        {!receivable.length ? <p className="muted">Nenhum item aguarda recebimento com sua permissão. A ADM deve registrar a compra ou locação como providenciada.</p> : <label>Pedido e item<select value={selectedLine} onChange={event => setSelectedLine(event.target.value)}><option value="">Selecione</option>{receivable.map(({order,line}) =>
          <option key={line.id} value={line.id}>{teamName(order.team_id)} · {order.id.slice(0,8)} · {line.description} · faltam {line.quantity-line.received_quantity}</option>)}</select></label>}
        {chosen && <div key={chosen.line.id}><p>Solicitado: {chosen.line.quantity} · recebido: {chosen.line.received_quantity} · faltante: {chosen.line.quantity - chosen.line.received_quantity}</p><OrderReceipt {...chosen} submit={submit} /></div>}
      </> : <>
        <p className="alert">Use somente para uma chegada que não corresponde a um pedido cadastrado. Confira os pedidos antes de continuar.</p>
        <label>Tipo de item<select value={kind} onChange={event => setKind(event.target.value)}>{directMaterial && <option value="material">Material</option>}{directEpi && <option value="epi">EPI / fardamento / item pessoal</option>}</select></label>
        <SiteOperationForm key={kind} title="Registrar entrada sem pedido" command={kind === "epi" ? "epi_entry" : "material_entry"} submit={submit}
          fields={[{ ...teamField, label: "Equipe / local que recebeu", options: allowedTeams }, { name: "item_id", label: "Item recebido", type: "select", options: kind === "epi" ? data.epi_items : data.materials.map(item => ({id:item.id,name:item.name+" · "+item.unit})), value: initialItem }, quantity,
            ...(kind === "epi" ? [{ name: "variant", label: "Variante / tamanho", required: false }, { name: "ca_number", label: "C.A. (obrigatório para EPI)", required: false }, { name: "brand_model", label: "Marca / modelo", required: false }, { name: "lot_number", label: "Lote", required: false }] : []), note]} />
      </>}
    </div>
  </section>;
}

export function MaterialOperations({ data, profile, submit, initialItem, initialType }: Props) {
  const [kind, setKind] = useState(initialType === "consumption" || !can(profile,"materials:write") ? "consumption" : "transfer");
  const [teamId, setTeamId] = useState("");
  const [itemId, setItemId] = useState(initialItem ?? "");
  const { allowedTeams, teamName, note } = siteFields(data, profile);
  const team = data.teams.find(team => team.id === teamId);
  const work = data.works.find(work => work.id === team?.worksite_id);
  const item = data.materials.find(item => item.id === itemId);
  const balance = item?.stock.filter(stock => stock.team_id === (work?.stock_team_id ?? teamId)).reduce((sum,stock)=>sum+stock.quantity,0) ?? 0;
  const options = [{ id: "transfer", name: "Transferir" },{ id: "return", name: "Devolução de material" },{ id: "exit", name: "Saída / baixa" }];
  return <section className="panel"><header className="panel-header"><div><h2>Movimentar material</h2><p>Mesma ficha de movimentação, com saldo da obra e data do fato.</p></div></header><div className="panel-body">
    <div className="form-grid"><label>Material<select value={itemId} onChange={event=>setItemId(event.target.value)}><option value="">Selecione</option>{data.materials.map(item=><option key={item.id} value={item.id}>{item.name} · {item.code} · {item.unit}</option>)}</select></label>
    <label>Operação<select value={kind} onChange={event=>setKind(event.target.value)}>{can(profile,"consumption:write")&&<option value="consumption">Consumo</option>}{can(profile,"materials:write")&&options.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
    <label>Equipe {kind === "consumption" ? "que consumiu" : "de origem"}<select value={teamId} onChange={event=>setTeamId(event.target.value)}><option value="">Selecione</option>{allowedTeams.map(team=><option key={team.id} value={team.id}>{team.name}</option>)}</select></label></div>
    {teamId && item && <><p className="alert">Estoque físico: <strong>{work?.name ?? teamName(teamId)}</strong> · saldo: <strong>{balance} {item.unit}</strong>. {work && "O saldo é compartilhado pelas equipes da obra."}</p>
      {balance <= 0 ? <p className="muted">Sem saldo disponível neste local.</p> : <SiteOperationForm key={[kind,teamId,itemId].join("-")} title="Informar quantidade e confirmar" command="material_movement" fixed={{ item_id:itemId, origin_team_id:teamId, movement_type:kind }} submit={submit} fields={[
        { name:"quantity", label:"Quantidade ("+item.unit+")", type:"number",value:"1",max:balance },
        ...(["transfer","return"].includes(kind)?[{ name:"destination_team_id",label:"Destino",type:"select" as const,options:data.teams.filter(candidate=>candidate.id!==teamId && (!work || candidate.worksite_id!==work.id)) }]:[]), note]} />}
    </>}
  </div></section>;
}

export function EquipmentOperations({data,profile,submit,initialAsset}:Props) {
  const [kind,setKind]=useState("transfer");
  const {note}=siteFields(data,profile);
  return <section className="panel"><header className="panel-header"><h2>Movimentar equipamento</h2></header><div className="panel-body">
    <label>Operação<select value={kind} onChange={event=>setKind(event.target.value)}><option value="transfer">Transferir</option><option value="assign">Atribuir</option><option value="return">Retornar ao estoque</option><option value="maintenance">Manutenção</option><option value="status_change">Alterar condição</option></select></label>
    <SiteOperationForm key={kind} title="Selecionar máquina e registrar" command="asset_movement" fixed={{movement_type:kind}} submit={submit} fields={[
      {name:"asset_id",label:"Máquina / patrimônio",type:"select",value:initialAsset,options:data.assets.filter(asset=>asset.active&&canOperateTeam(profile,asset.team_id)).map(asset=>({id:asset.id,name:asset.name+" · "+asset.code}))},
      ...(["transfer","assign","return"].includes(kind)?[{name:"destination_team_id",label:"Equipe / local de destino",type:"select" as const,options:data.teams}]:[]),
      {name:"new_status",label:"Situação",type:"select",value:kind==="maintenance"?"maintenance":"available",options:[{id:"available",name:"Disponível"},{id:"in_use",name:"Em uso"},{id:"maintenance",name:"Manutenção"},{id:"damaged",name:"Danificado"},{id:"lost",name:"Perdido"},{id:"retired",name:"Baixado"}]},note]} />
    <p className="muted">Para entrega de uma máquina alugada à locadora, use a devolução na ficha da máquina. O retorno ao estoque acima mantém a máquina na empresa.</p>
  </div></section>;
}

export function IntegratedDelivery({data,profile,submit,initialEmployee,initialItem}:Props) {
  const {teamName,workName}=siteFields(data,profile);
  return <section className="panel"><header className="panel-header"><h2>Entrega individual</h2></header><div className="panel-body"><EpiDeliveryForm submit={submit} initialEmployee={initialEmployee} initialItem={initialItem}
    employees={data.employees.filter(person=>canOperateTeam(profile,person.team_id)).map(person=>({id:person.id,name:person.name,team:teamName(person.team_id),homeTeam:teamName(person.home_team_id),worksiteId:data.teams.find(team=>team.id===person.team_id)?.worksite_id ?? null}))}
    batches={data.batches.filter(batch=>batch.quantity>0 && data.epi_items.some(item=>item.id===batch.item_id && item.kind!=="personal_tool")).map(batch=>({id:batch.id,itemId:batch.item_id,itemName:data.epi_items.find(item=>item.id===batch.item_id)?.name??"Item",itemCode:data.epi_items.find(item=>item.id===batch.item_id)?.code??"",variant:batch.variant,quantity:batch.quantity,unit:data.epi_items.find(item=>item.id===batch.item_id)?.unit??"un",ca:batch.ca_number,worksiteId:batch.worksite_id,location:workName(batch.worksite_id)}))} /></div></section>;
}

export function IntegratedBatchDelivery({data,profile,submit,initialEmployee}:Props) {
  const {teamName,workName}=siteFields(data,profile);
  return <section className="panel"><header className="panel-header"><h2>Entrega de vários itens</h2></header><div className="panel-body"><BatchDeliveryForm submit={submit} initialEmployee={initialEmployee}
    employees={data.employees.filter(person=>canOperateTeam(profile,person.team_id)).map(person=>({id:person.id,full_name:person.name,team:teamName(person.team_id),worksite_id:data.teams.find(team=>team.id===person.team_id)?.worksite_id??null}))}
    batches={data.batches.filter(batch=>data.epi_items.some(item=>item.id===batch.item_id && item.kind!=="personal_tool")).map(batch=>({...batch,name:data.epi_items.find(item=>item.id===batch.item_id)?.name??"Item",unit:data.epi_items.find(item=>item.id===batch.item_id)?.unit??"un",lot_number:batch.lot_number??null,location:workName(batch.worksite_id)}))}/></div></section>;
}
