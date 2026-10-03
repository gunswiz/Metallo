import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withHttpScheduling } from './agendamento-http.mjs';
test('fronteira cede I/O entre operações completas, mantendo FIFO e retorno',async()=>{
 const order=[];const core=withHttpScheduling({checkpoint:async n=>{order.push(n);if(n===1)setImmediate(()=>order.push('IO'));return n;}});
 assert.deepEqual(await Promise.all([core.checkpoint(1),core.checkpoint(2)]),[1,2]);assert.deepEqual(order,[1,'IO',2]);
});
test('erro do guard permanece rejeitado e não impede operação seguinte',async()=>{
 const error=Object.assign(Error('SESSAO_ENCERRADA'),{status:401});let authorized=0;
 const core=withHttpScheduling({history:async bad=>{if(bad)throw error;authorized++;return 'own';}});
 const results=await Promise.allSettled([core.history(true),core.history(false)]);assert.equal(results[0].reason,error);assert.equal(results[1].value,'own');assert.equal(authorized,1);
});

test('admissão R5: rede de leitor não ocupa FIFO de mutação; sem prioridade artificial',async()=>{
 let release;const pending=new Promise(ok=>{release=ok;}),order=[];const c=withHttpScheduling({personalRead:async()=>{order.push('read-start');await pending;order.push('read-end');},personalOperation:async()=>{order.push('mutation');}});const read=c.personalRead();await c.personalOperation();assert.deepEqual(order,['read-start','mutation']);release();await read;assert.deepEqual(order,['read-start','mutation','read-end']);
});
