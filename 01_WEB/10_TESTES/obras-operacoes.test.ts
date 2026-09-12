import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createOperationQueue} from '@/03_FUNCOES_E_LOGICA/fila-operacoes';
import {eventTime} from '@/03_FUNCOES_E_LOGICA/operacoesObra';
import {can, canOperateTeam} from '@metallo/core';

beforeEach(()=>{
  localStorage.clear();
  Object.defineProperty(navigator,'locks',{configurable:true,value:{request:vi.fn(async (_key:string,callback:()=>void)=>callback())}});
});
describe('fila de operações por usuário',()=>{
  const entry=()=>({id:crypto.randomUUID(),command:'consume',data:{actor_id:'a',quantity:2},occurredAt:'2026-09-09T12:00:00Z'});
  it('persiste antes do envio, preserva outra aba e isola contas',async()=>{
    const first=createOperationQueue('a'),second=createOperationQueue('a');
    const a=entry(),b=entry();
    await first.update(rows=>[...rows,a]);await second.update(rows=>[...rows,b]);
    expect(first.read().entries).toHaveLength(2);
    await first.update(rows=>rows.filter(row=>row.id!==a.id));
    expect(second.read().entries).toEqual([b]);
    expect(createOperationQueue('b').read().entries).toEqual([]);
    expect(createOperationQueue('a').read().entries).toEqual([b]);
  });
  it('não sobrescreve fila corrompida ou de outra conta',async()=>{
    const key='metallo-operations-v1-a';localStorage.setItem(key,'invalid');
    const queue=createOperationQueue('a');expect(queue.read().error).toBeTruthy();
    await expect(queue.update(()=>[entry()])).rejects.toThrow();expect(localStorage.getItem(key)).toBe('invalid');
    localStorage.setItem(key,JSON.stringify([{...entry(),data:{actor_id:'b'}}]));
    expect(createOperationQueue('a').read().error).toBeTruthy();
  });
  it('avisa quando o navegador não consegue salvar sem perder dados',async()=>{
    const queue=createOperationQueue('a');await queue.update(()=>[entry()]);
    const previous=localStorage.getItem('metallo-operations-v1-a');
    const spy=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('quota');});
    await expect(queue.update(rows=>[...rows,entry()])).rejects.toThrow('quota');spy.mockRestore();
    expect(localStorage.getItem('metallo-operations-v1-a')).toBe(previous);
  });
  it('considera o horário de Fortaleza e rejeita data futura',()=>{
    expect(eventTime('2026-09-01T16:20')).toBe('2026-09-01T19:20:00.000Z');
    expect(()=>eventTime('2099-01-01T12:00')).toThrow();
  });
  it('concede direitos e equipes explicitamente sem promover o cargo',()=>{
    const profile={role:'collaborator' as const,active:true,teamId:'a',operationPermissions:['epi:write'],operationTeamIds:['a','b']};
    expect(can(profile,'epi:read')).toBe(true);expect(can(profile,'admin:manage')).toBe(false);
    expect(canOperateTeam(profile,'b')).toBe(true);expect(canOperateTeam(profile,'c')).toBe(false);
    expect(can({...profile,active:false},'epi:write')).toBe(false);
  });
});
