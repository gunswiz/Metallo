import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {SiteOperations} from '@/02_COMPONENTES_VISUAIS/obras-pedidos';
import type {SiteSnapshot} from '@/03_FUNCOES_E_LOGICA/operacoesObra';
const {rpc}=vi.hoisted(()=>({rpc:vi.fn()}));
const userId='a0000000-0000-4000-8000-000000000001';
vi.mock('@/05_ACESSO_A_DADOS/Supabase/client',()=>({createClient:()=>({rpc,auth:{getUser:async()=>({data:{user:{id:'a0000000-0000-4000-8000-000000000001'}}})}})}));
const data:SiteSnapshot={works:[],teams:[{id:'team',name:'Equipe Teste',worksite_id:null,central:false}],materials:[{id:'material',name:'Disco de teste',code:'MAT',unit:'un',stock:[]}],epi_items:[],batches:[],employees:[],assignments:[],assets:[],orders:[],rental_returns:[],rental_details:[],alerts:[]};
const profile={id:userId,fullName:'Responsável Teste',role:'collaborator' as const,active:true,teamId:'team',operationPermissions:['consumption:write'],operationTeamIds:null};
beforeEach(()=>{
 localStorage.clear();rpc.mockReset();
 Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async (_:string,callback:()=>void)=>callback()}});
 Object.defineProperty(navigator,'onLine',{configurable:true,value:true});
});
afterEach(cleanup);
it('mostra apenas os direitos concedidos e reserva alertas para ADM',()=>{
 render(<SiteOperations initial={data} profile={profile}/>);
 expect(screen.getByText('Registrar consumo diário')).toBeInTheDocument();
 expect(screen.queryByText('Registrar compra entregue direto na obra')).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:/Alertas/})).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Obras e equipes'})).not.toBeInTheDocument();
});
it('duplo envio não duplica lançamento e falha de resposta mantém o mesmo identificador',async()=>{
 let release:()=>void=()=>{};
 const gate=new Promise<void>(resolve=>{release=resolve;});
 const sent:string[]=[];let fail=true;
 rpc.mockImplementation(async(command:string,args:Record<string,unknown>)=>{
   if(command==='site_dashboard')return {data,error:null};
   sent.push(args.p_operation_id as string);
   expect(localStorage.getItem(`metallo-operations-v1-${userId}`)).toContain(sent.at(-1));
   await gate;
   return {data:{},error:fail?{message:'network failure'}:null};
 });
 render(<SiteOperations initial={data} profile={profile}/>);
 fireEvent.change(screen.getByLabelText('Equipe que está executando o serviço'),{target:{value:'team'}});
 fireEvent.change(screen.getByLabelText('Material consumido'),{target:{value:'material'}});
 fireEvent.change(screen.getByLabelText('Quantidade'),{target:{value:'2'}});
 const form=screen.getByRole('button',{name:'Registrar',hidden:true}).closest('form')!;
 fireEvent.submit(form);fireEvent.submit(form);
 await waitFor(()=>expect(sent).toHaveLength(1));release();
 await screen.findByText(/1 lançamento\(s\) aguardando confirmação/);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Atualizar e enviar pendentes'})).toBeEnabled());
 fail=false;fireEvent.click(screen.getByRole('button',{name:'Atualizar e enviar pendentes'}));
 await waitFor(()=>expect(localStorage.getItem(`metallo-operations-v1-${userId}`)).toBe('[]'));
 expect(sent).toEqual([sent[0],sent[0]]);
});
