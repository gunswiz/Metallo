"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Boxes, Users, HardHat, Truck, ClipboardList, RotateCcw } from "lucide-react";
import type { SessionProfile } from "@metallo/types";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { MaterialOperations, EquipmentOperations, IntegratedDelivery, IntegratedBatchDelivery, ReceivingForm } from "@/02_COMPONENTES_VISUAIS/operacoes-integradas";
import { LocacoesObra } from "@/02_COMPONENTES_VISUAIS/ObrasEPedidos/locacoes";
import { PedidosObra } from "@/02_COMPONENTES_VISUAIS/ObrasEPedidos/pedidos";
import type { SiteSnapshot } from "@/03_FUNCOES_E_LOGICA/operacoesObra";
import { eventTime } from "@/03_FUNCOES_E_LOGICA/operacoesObra";
import type { SubmitOperation } from "@/02_COMPONENTES_VISUAIS/formulario-obra";
import styles from "./preview.module.css";

const initial:SiteSnapshot={
  works:[{id:"obra",name:"Obra Cobertura",stock_team_id:"a",active:true},{id:"estrutura",name:"Obra Estrutura",stock_team_id:"c",active:true}],
  teams:[{id:"central",name:"COSEM",worksite_id:null,central:true},{id:"a",name:"Equipe A",worksite_id:"obra",central:false},{id:"b",name:"Equipe B",worksite_id:"obra",central:false},{id:"c",name:"Equipe C",worksite_id:"estrutura",central:false}],
  materials:[{id:"disco",name:"Disco de corte",code:"MAT-001",unit:"un",stock:[{team_id:"a",quantity:60},{team_id:"central",quantity:100}]},{id:"eletrodo",name:"Eletrodo",code:"MAT-002",unit:"caixa",stock:[{team_id:"a",quantity:8}]}],
  epi_items:[{id:"oculos",name:"Óculos de proteção",code:"EPI-001",kind:"epi",unit:"un",variants:[]}],
  batches:[{id:"lote1",item_id:"oculos",quantity:15,variant:null,ca_number:"12345 (exemplo)",worksite_id:"obra"},{id:"lote2",item_id:"oculos",quantity:12,variant:null,ca_number:"54321 (exemplo)",worksite_id:"estrutura"}],
  employees:[{id:"joao",name:"João · exemplo",team_id:"b",home_team_id:"a"}],assignments:[],
  assets:[{id:"maq1",name:"Parafusadeira",code:"LOC-021",number:"021",company:"Locadora Exemplo",team_id:"b",status:"available",active:true,ownership:"rented"}],
  orders:[{id:"pedido001",team_id:"b",status:"partial",note:"Discos para cobertura",occurred_at:"2026-09-12T12:00:00Z",created_at:"2026-09-12T12:00:00Z",lines:[{id:"linha001",kind:"material",description:"Disco de corte · un",variant:null,quantity:10,received_quantity:6}],events:[]}],
  rental_returns:[],rental_details:[],alerts:[],
};
const tabs=[["materials","Materiais",Boxes],["epi","EPI e funcionário",HardHat],["equipment","Equipamentos",Truck],["orders","Pedidos e recebimentos",ClipboardList]] as const;
export function CorrectionsPreview(){
  const [data,setData]=useState(()=>structuredClone(initial));
  const current=useRef(data);
  const [tab,setTab]=useState("materials");
  const [admin,setAdmin]=useState(false);
  const [narrow,setNarrow]=useState(false);
  const [message,setMessage]=useState("");
  const [history,setHistory]=useState<string[]>([]);
  const [search,setSearch]=useState("");
  const [batchDelivery,setBatchDelivery]=useState(true);
  const profile:SessionProfile={id:"preview",fullName:"Responsável da obra",active:true,role:admin?"admin":"leader",teamId:"b",operationPermissions:["materials:write","equipment:write","consumption:write","epi:write","requests:write","rentals:write"],operationTeamIds:["a","b"]};
  const submit:SubmitOperation=async(command,payload,time)=>{
    const occurred=eventTime(time);
    const next=structuredClone(current.current);
    const quantity=Number(payload.quantity);
    const physical=(id:unknown)=>{const team=next.teams.find(team=>team.id===id);return next.works.find(work=>work.id===team?.worksite_id)?.stock_team_id??String(id);};
    const changeStock=(itemId:unknown,teamId:unknown,amount:number)=>{
      const item=next.materials.find(item=>item.id===itemId);if(!item)throw Error("Selecione o material.");
      const team=physical(teamId);const stock=item.stock.find(row=>row.team_id===team);
      if(amount<0&&(!stock||stock.quantity<-amount))throw Error("Saldo insuficiente.");
      if(stock)stock.quantity+=amount;else item.stock.push({team_id:team,quantity:amount});
    };
    if(["material_movement","material_entry","receive_order"].includes(command)&&(!Number.isInteger(quantity)||quantity<1))throw Error("Informe uma quantidade inteira maior que zero.");
    if(command==="material_movement"){
      changeStock(payload.item_id,payload.origin_team_id,-quantity);
      if(payload.destination_team_id)changeStock(payload.item_id,payload.destination_team_id,quantity);
    } else if(command==="material_entry")changeStock(payload.item_id,payload.team_id,quantity);
    else if(command==="receive_order"){
      const order=next.orders.find(order=>order.id===payload.order_id);const line=order?.lines.find(line=>line.id===payload.line_id);
      if(!line||!order||quantity>line.quantity-line.received_quantity)throw Error("Confira o que falta no pedido.");
      line.received_quantity+=quantity;order.status=line.received_quantity===line.quantity?"received":"partial";changeStock("disco",order.team_id,quantity);
    }else if(command==="deliver_epi"){
      const lines=payload.lines as Array<{stock_batch_id:string;quantity:number}>;
      for(const line of lines){const batch=next.batches.find(batch=>batch.id===line.stock_batch_id);if(!batch||line.quantity<1||line.quantity>batch.quantity)throw Error("Confira o lote e a quantidade.");batch.quantity-=line.quantity;}
    }else if(command==="rental_notify"){
      next.rental_returns.push({id:"aviso",asset_id:String(payload.asset_id),team_id:"b",note:String(payload.note),status:"pending",occurred_at:occurred});
    }else if(command==="rental_resolve"){
      const request=next.rental_returns.find(request=>request.id===payload.request_id);if(request){request.status=String(payload.status);if(request.status==="returned"){const asset=next.assets.find(asset=>asset.id===request.asset_id);if(asset){asset.active=false;asset.status="retired";}}}
    }else if(command==="rental_details"){
      next.rental_details=[{asset_id:String(payload.asset_id),amount:payload.amount===""?null:Number(payload.amount),billing_period:String(payload.billing_period)||null,expected_return:String(payload.expected_return)||null,billing_closed_on:String(payload.billing_closed_on)||null,note:String(payload.note)||null}];
    }else if(command==="asset_movement"){
      const asset=next.assets.find(asset=>asset.id===payload.asset_id);if(asset){if(payload.destination_team_id)asset.team_id=String(payload.destination_team_id);asset.status=String(payload.new_status);}
    }else if(command==="epi_entry"){
      if(!Number.isInteger(quantity)||quantity<1)throw Error("Confira a quantidade.");
      const team=next.teams.find(team=>team.id===payload.team_id);
      next.batches.push({id:crypto.randomUUID(),item_id:String(payload.item_id),quantity,variant:String(payload.variant)||null,ca_number:String(payload.ca_number)||null,worksite_id:team?.worksite_id??null});
    }else if(command==="create_order"){
      const requestedLines=Array.isArray(payload.lines)?payload.lines as Array<{kind:string;item_id?:string;epi_item_id?:string;description:string;variant?:string;quantity:number}>:[];
      if(!requestedLines.length)throw Error("Adicione pelo menos um item à lista.");
      if(requestedLines.some(line=>line.kind==="rental"))throw Error("Máquinas são registradas na área de locações quando a necessidade for decidida.");
      next.orders.unshift({id:"pedido-local-"+crypto.randomUUID(),team_id:String(payload.team_id),status:"submitted",note:String(payload.note??""),occurred_at:occurred,created_at:new Date().toISOString(),lines:requestedLines.map((line,index)=>({id:"linha-local-"+index,kind:line.kind,description:line.description,variant:line.variant||null,quantity:line.quantity,received_quantity:0})),events:[]});
    }else throw Error("Essa operação não está habilitada nesta demonstração. O formulário faz parte do sistema; nenhum dado foi enviado.");
    current.current=next;setData(next);
    setMessage("Registro guardado somente nesta prévia. Os saldos fictícios abaixo foram atualizados.");
    setHistory(rows=>[command+" · "+occurred+" · "+(quantity>0?quantity:"")+" "+(payload.note??""),...rows]);
  };
  return <main className={styles.root}>
    <div className={styles.notice}><strong>Prévia local das correções</strong><span>Componentes reais do web · dados fictícios · banco remoto sem alterações</span></div>
    <PageHeader eyebrow="METALLO · REVISÃO LOCAL" title="Sua rotina, com os caminhos integrados" description="As fichas, o histórico e os atalhos continuam. Os formulários abaixo são os mesmos usados nas telas corrigidas do web."/>
    <div className={styles.toolbar}><label><Users size={16}/> Visão<select value={admin?"admin":"leader"} onChange={event=>setAdmin(event.target.value==="admin")}><option value="leader">Responsável autorizado</option><option value="admin">ADM</option></select></label><button className="button ghost" onClick={()=>setNarrow(!narrow)}>{narrow?"Largura ampla":"Largura de celular"}</button><button className="button ghost" onClick={()=>{const next=structuredClone(initial);current.current=next;setData(next);setMessage("");setHistory([]);}}><RotateCcw size={16}/>Reiniciar dados</button><Link href="/previa/consumo" className="button secondary">Consumo circular e %</Link></div>
    <div className={narrow?styles.narrow:""}>
      <nav className={styles.tabs}>{tabs.map(([id,label,Icon])=><button key={id} className={"button "+(tab===id?"primary":"ghost")} onClick={()=>{setTab(id);setMessage("");}}><Icon size={17}/>{label}</button>)}</nav>
      {message&&<p className="alert success" role="status">{message}</p>}
      {tab==="materials"&&<>
        <section className="panel"><header className="panel-header"><div><h2>Materiais da Obra Cobertura</h2><p>Equipes A e B usam o mesmo estoque</p></div></header><div className="panel-body"><label>Pesquisar material<input placeholder="Nome ou código" value={search} onChange={event=>setSearch(event.target.value)}/></label><div className="list">{data.materials.filter(item=>(item.name+" "+item.code).toLowerCase().includes(search.toLowerCase())).map(item=><div className="list-row" key={item.id}><span className="list-row-main"><strong>{item.name}</strong><span>{item.code} · Obra Cobertura</span></span><strong>{item.stock.find(stock=>stock.team_id==="a")?.quantity??0} {item.unit}</strong></div>)}</div></div></section>
        <MaterialOperations data={data} profile={profile} submit={submit} initialItem="disco" initialType="consumption"/>
        <ReceivingForm data={data} profile={profile} submit={submit}/>
      </>}
      {tab==="epi"&&<><section className="detail-hero"><h2>João · ficha do funcionário</h2><p>Origem: Equipe A · Trabalhando com: Equipe B · Obra Cobertura</p><p>Kit, itens atribuídos, baixas e PDF individual continuam na ficha original. Nesta prévia, avalie a entrega com identificação do local e C.A.</p><button className="button secondary" onClick={()=>setBatchDelivery(!batchDelivery)}>{batchDelivery?"Entrega de um item":"Montar entrega com vários itens"}</button></section>{batchDelivery?<IntegratedBatchDelivery data={data} profile={profile} submit={submit} initialEmployee="joao"/>:<IntegratedDelivery data={data} profile={profile} submit={submit} initialEmployee="joao"/>}<ReceivingForm data={data} profile={profile} submit={submit} initialItem="oculos"/></>}
      {tab==="equipment"&&<><EquipmentOperations data={data} profile={profile} submit={submit}/><LocacoesObra data={data} profile={profile} submit={submit}/></>}
      {tab==="orders"&&<><ReceivingForm data={data} profile={profile} submit={submit}/><PedidosObra data={data} profile={profile} submit={submit}/></>}
    </div>
    {history.length>0&&<section className="panel"><header className="panel-header"><h2>Histórico da sua avaliação local</h2></header><div className="panel-body">{history.map((entry,index)=><p key={index}>{entry}</p>)}</div></section>}
    <p className="muted">Esta página permite avaliar os formulários sem gravar dados reais. O APK não foi gerado e a migração do banco não foi aplicada.</p>
  </main>;
}
