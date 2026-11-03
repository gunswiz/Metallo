import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// PostgreSQL embutido para regressão SQL; identidade mínima de ensaio, não prova de Auth remoto.
const db = new PGlite();
const employee = randomUUID();
const one = async (sql, args=[]) => Object.values((await db.query(sql,args)).rows[0])[0];
const itens = () => db.query('select * from public.my_frota_itens_10f()').then(r=>r.rows);
const respostas = rows => rows.map(i=>({codigo:i.codigo, situacao:'C', obs:'', versao:i.versao}));
const enviar = (rows,key=randomUUID()) => db.query('select * from public.create_checklist_10a(1,\'\',\'\',$1,true,$2)',[JSON.stringify(rows),key]).then(r=>r.rows[0]);
before(async()=>{
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema private; create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.user',true),'')::uuid $$;
    create table public.profiles(id uuid primary key, active boolean, role text, full_name text);
    create table public.epi_employees(id uuid primary key, full_name text);
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create function private.funcionario_do_app_3t() returns uuid language sql as $$ select auth.uid() $$;
    create function private.pode_atender_3t() returns boolean language sql as $$ select current_setting('test.manager',true)='yes' $$;
    grant usage on schema public,auth to authenticated,anon;`);
  await db.query('insert into auth.users values($1)',[employee]);
  await db.query("insert into public.profiles values($1,true,'admin','Gestor fictício')",[employee]);
  await db.query("insert into public.epi_employees values($1,'Fictício')",[employee]);
  await db.query("select set_config('test.user',$1,false)",[employee]);
  await db.exec("select set_config('test.manager','yes',false)");
  for (const path of ['teste-online/10a-frota.sql','teste-online/10b-frota-fotos.sql','teste-online/10c-frota-defeitos.sql',
    'laboratorio-marco-1a/supabase/migrations/20261102064120_frota_recusas_e_conteudo_10e.sql']) {
    await db.exec(await readFile(new URL('../04_BANCO_E_SUPABASE/'+path,import.meta.url),'utf8'));
  }
  // Registro de antes da mudança: não pode ganhar um texto histórico inventado.
  const old = (await db.query('select * from public.my_frota_itens_10a()')).rows;
  await enviar(old.map(i=>({codigo:i.codigo,situacao:'C',obs:''})));
  await db.exec(await readFile(new URL('../04_BANCO_E_SUPABASE/laboratorio-marco-1a/supabase/migrations/20261103002924_frota_versao_e_historico_10f.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../04_BANCO_E_SUPABASE/laboratorio-marco-1a/supabase/migrations/20261103010238_frota_modelos_por_categoria_10g.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../04_BANCO_E_SUPABASE/laboratorio-marco-1a/supabase/migrations/20261103071122_frota_categoria_veiculo_10h.sql',import.meta.url),'utf8'));
});
after(()=>db.close());

const modelo = (categoria, revisao=null) => one('select public.admin_modelos_frota_10g($1,$2)',[categoria,revisao]);
test('categoria não é presumida, guarda histórico e rejeita edição antiga e troca durante viagem',async()=>{
  const ler=()=>one('select public.admin_categoria_veiculo_10h(1)');
  const definir=(c,b)=>db.query('select public.admin_definir_categoria_10h(1,$1,$2)',[c,b]);
  assert.equal((await ler()).categoria,null);
  const checklistAntes=await itens();
  await definir('saveiro',0);
  await definir('saveiro',0);
  assert.equal((await ler()).revisao,1,'reenvio não duplica alteração');
  await assert.rejects(definir('munck',0),/categoria_revisao_conflito/);
  await assert.rejects(definir('inexistente',1),/modelo_invalido/);
  await db.exec("update private.frota_veiculos_10a set situacao='em_uso' where id=1");
  await assert.rejects(definir('munck',1),/categoria_veiculo_em_uso/);
  await db.exec("update private.frota_veiculos_10a set situacao='disponivel' where id=1; update public.profiles set role='employee'");
  try { await assert.rejects(definir('munck',1),/gestao_required/); }
  finally { await db.exec("update public.profiles set role='admin'"); }
  await definir(null,1);
  assert.equal((await ler()).categoria,null);
  assert.equal(await one("select count(*)::integer from private.frota_eventos_10a where veiculo_id=1 and tipo='categoria'"),2);
  assert.deepEqual(await itens(),checklistAntes,'classificação não ativa rascunho');
});
const salvarModelo = (m, key=randomUUID(), base=m.revisao) => one('select public.admin_salvar_modelo_frota_10g($1,$2,$3,$4,$5,$6)',[m.categoria,m.nome,base,JSON.stringify(m.itens),'Revisão fictícia de ensaio',key]);

test('rascunhos por categoria preservam o checklist operacional e separam equipamentos',async()=>{
  const munck=await modelo('munck'), saveiro=await modelo('saveiro');
  assert.equal(munck.atual,2);
  assert.equal(saveiro.atual,1);
  assert.ok(munck.modelo.itens.some(i=>i.etapa==='Estabilizadores'));
  assert.ok(!saveiro.modelo.itens.some(i=>['Estabilizadores','Içamento','Hidráulica'].includes(i.etapa)));
  const antes=await itens();
  const key=randomUUID(), editado={...saveiro.modelo,itens:saveiro.modelo.itens.map(i=>({...i,nome:'Revisado '+i.codigo}))};
  assert.equal(await salvarModelo(editado,key),2);
  assert.equal(await salvarModelo(editado,key),2,'reenvio retorna a revisão sem duplicar');
  assert.deepEqual(await itens(),antes,'rascunho não ativa regras no portal');
  assert.deepEqual((await modelo('saveiro',1)).modelo.itens,saveiro.modelo.itens);
  await assert.rejects(salvarModelo({...editado,itens:saveiro.modelo.itens},key),/idempotency_conflict/);
  await assert.rejects(salvarModelo(editado),/modelo_revisao_conflito/);
  await assert.rejects(db.exec("delete from private.frota_modelos_10g where categoria='saveiro'"),/modelo_historico_imutavel/);
});

test('modelo rejeita perguntas duplicadas ou inválidas e escrita sem papel autorizado',async()=>{
  const m=(await modelo('saveiro')).modelo;
  for (const invalidos of [[],[m.itens[0],m.itens[0]],[{...m.itens[0],critico:'sim'}],[{...m.itens[0],etapa:'Inventada'}]]) {
    await assert.rejects(salvarModelo({...m,itens:invalidos}),/modelo_invalido/);
  }
  await db.exec("update public.profiles set role='employee'");
  try { await assert.rejects(salvarModelo(m),/gestao_required/); }
  finally { await db.exec("update public.profiles set role='admin'"); }
  assert.equal(await one("select has_function_privilege('anon','public.admin_modelos_frota_10g(text,integer)','execute')"),false);
  assert.equal(await one("select has_table_privilege('authenticated','private.frota_modelos_10g','insert')"),false);
});

test('histórico conserva texto e criticidade; mudança de regra altera versão e recusa envio antigo',async()=>{
  const before = await itens(), key=randomUUID(), payload=respostas(before);
  const saved = await enviar(payload,key);
  assert.match(before[0].versao,/^[a-f0-9]{64}$/);
  await db.exec("update private.frota_itens_10a set nome='Pergunta nova',critico=not critico where codigo=1");
  const current = await itens();
  assert.notEqual(current[0].versao,before[0].versao);
  const detail=await one('select public.admin_frota_checklist_10a($1)',[saved.id]);
  assert.equal(detail.itens[0].nome,before[0].nome);
  assert.equal(detail.itens[0].critico,before[0].critico);
  assert.equal(detail.checklist.modelo_versao,before[0].versao);
  assert.deepEqual(await enviar(payload,key),saved,'resposta perdida continua idempotente após mudar configuração');
  await assert.rejects(enviar(payload),/checklist_versao_desatualizada/);
  await assert.rejects(enviar(payload.map(r=>({...r,versao:undefined}))),/checklist_versao_desatualizada/);
  await assert.rejects(enviar(payload.map(r=>({...r,obs:'alterado'})),key),/idempotency_conflict/);
  const fresh=await enviar(respostas(current));
  assert.notEqual(fresh.id,saved.id);
  await assert.rejects(db.query('update private.frota_checklists_10a set modelo_snapshot=null,modelo_versao=null where id=$1',[saved.id]),/modelo_historico_imutavel/);
});

test('legado é identificado sem atribuir nomes atuais às respostas antigas',async()=>{
  const detail=await one('select public.admin_frota_checklist_10a(1)');
  assert.equal(detail.checklist.modelo_versao,null);
  assert.match(detail.itens[0].nome,/texto histórico não preservado/);
});

test('não aceita conjunto vazio, versão parcial, duplicação ou versão forjada',async()=>{
  const current=respostas(await itens());
  await assert.rejects(enviar([]),/checklist_versao_desatualizada/);
  await assert.rejects(enviar(current.map((r,i)=>i===0?{...r,versao:'a'.repeat(64)}:r)),/checklist_versao_desatualizada/);
  await assert.rejects(enviar(current.slice(1)),/itens_incompletos/);
  await assert.rejects(enviar([...current.slice(1),current[1]]),/itens_incompletos/);
});

test('relato da manutenção e aviso usam texto congelado, sem desbloquear por novo checklist limpo',async()=>{
  const current = await itens();
  const payload = respostas(current);
  payload[0] = {...payload[0], situacao:'N', obs:'Defeito fictício'};
  await enviar(payload);
  await db.exec("update private.frota_itens_10a set nome='Texto posterior ao defeito' where codigo=1");
  const reports = (await db.query('select * from public.admin_frota_relatos_10c(1)')).rows;
  assert.equal(reports[0].relatos[0].itens[0].item,current[0].nome);
  const notice = (await db.query('select * from public.avisar_defeito_frota_10c(1)')).rows[0];
  assert.equal(notice.resumo,current[0].nome);
  await enviar(respostas(await itens()));
  assert.equal(await one('select situacao from private.frota_veiculos_10a where id=1'),'nao_liberado');
});

test('anon não consulta; autenticado sem identidade é negado; tabela privada continua fechada',async()=>{
  assert.equal(await one("select has_function_privilege('anon','public.my_frota_itens_10f()','execute')"),false);
  assert.equal(await one("select has_table_privilege('authenticated','private.frota_checklists_10a','select')"),false);
  await db.exec("select set_config('test.user','',false); set role authenticated");
  await assert.rejects(itens(),/portal_access_denied/);
  await db.exec('reset role');
  await db.query("select set_config('test.user',$1,false)",[employee]);
});
