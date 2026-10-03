"use client";
import { useState, type FormEvent } from "react";
import { eventTime, localEventTime, type PendingOperation, type SiteSnapshot } from "@/03_FUNCOES_E_LOGICA/operacoesObra";
export function PendingReview({entry,data,busy,onSave}:{entry:PendingOperation;data:SiteSnapshot;busy:boolean;onSave:(entry:PendingOperation)=>Promise<void>}){
  const [error,setError]=useState("");
  const choices:Record<string,Array<{id:string;name:string}>>={
    team_id:data.teams,origin_team_id:data.teams,destination_team_id:data.teams,
    item_id:entry.command.startsWith("epi")?data.epi_items:data.materials,
    employee_id:data.employees,
  };
  const labels:Record<string,string>={team_id:"Equipe",origin_team_id:"Equipe de origem",destination_team_id:"Destino",item_id:"Item",employee_id:"Funcionário",quantity:"Quantidade",note:"Observação",variant:"Variante",ca_number:"C.A."};
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const values=new FormData(event.currentTarget);
    const payload={...entry.data};
    for(const [key,value] of values.entries())if(key!=="time")payload[key]=key==="quantity"?Number(value):String(value);
    try{await onSave({...entry,data:payload,occurredAt:eventTime(String(values.get("time"))),failure:undefined,error:undefined});}
    catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível revisar a fila.");}
  }
  return <details><summary>Revisar lançamento recusado</summary><form className="form-grid" onSubmit={save}>
    {Object.entries(entry.data).filter(([key])=>key in labels).map(([key,value])=><label key={key}>{labels[key]}{choices[key]?<select name={key} defaultValue={String(value??"")} required><option value="">Selecione</option>{choices[key].map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select>:<input name={key} defaultValue={String(value??"")} type={key==="quantity"?"number":"text"} min={key==="quantity"?1:undefined} maxLength={500}/>}</label>)}
    <label>Quando aconteceu? (Fortaleza)<input name="time" type="datetime-local" required defaultValue={localEventTime(new Date(entry.occurredAt))}/></label>
    {Array.isArray(entry.data.lines)&&<p className="muted full">Para trocar lotes ou itens de uma entrega recusada, retire este lançamento recusado e refaça a entrega com os lotes corretos. Reenvios sem mudança mantêm a mesma identificação.</p>}
    {error&&<p className="alert error full">{error}</p>}
    <div className="form-actions"><button className="button secondary" disabled={busy} type="submit">Guardar correção e reenviar</button></div>
  </form></details>;
}
