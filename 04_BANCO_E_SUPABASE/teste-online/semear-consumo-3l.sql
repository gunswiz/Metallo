-- Marco 3L — dados FICTÍCIOS de consumo para o ambiente de teste online (nunca produção).
-- Cria materiais de exemplo, saldos e ~90 dias de consumo para o painel com gráficos.
-- Pode rodar de novo: apaga só os lançamentos marcados com a nota abaixo e recria.
begin;

do $$
begin
  if not exists (select 1 from public.teams where name = 'Equipe Solda A')
     or not exists (select 1 from public.teams where name = 'Equipe Montagem B') then
    raise exception 'Rode primeiro semear-teste-online.mjs (equipes de teste não encontradas).';
  end if;
end $$;

insert into public.items (code, name, category, item_type, unit, minimum_stock) values
  ('MAT-001', 'Eletrodo E6013 2,5 mm', 'Solda', 'material', 'cx', 5),
  ('MAT-002', 'Disco de corte 7"', 'Abrasivos', 'material', 'un', 30),
  ('MAT-003', 'Disco de desbaste 7"', 'Abrasivos', 'material', 'un', 20),
  ('MAT-004', 'Lixa flap 4 1/2" grão 60', 'Abrasivos', 'material', 'un', 30),
  ('MAT-005', 'Broca aço rápido 10 mm', 'Ferramentas', 'material', 'un', 10),
  ('MAT-006', 'Escova de aço rotativa', 'Abrasivos', 'material', 'un', 5),
  ('MAT-007', 'Bico de contato MIG 1,0 mm', 'Solda', 'material', 'un', 20),
  ('MAT-008', 'Eletrodo E7018 3,25 mm', 'Solda', 'material', 'cx', 5),
  ('MAT-009', 'Arame MIG ER70S-6 1,0 mm', 'Solda', 'material', 'kg', 30),
  ('MAT-010', 'Tinta de fundo cinza', 'Pintura', 'material', 'l', 10),
  ('MAT-011', 'Thinner', 'Pintura', 'material', 'l', 10),
  ('MAT-012', 'Disco de corte 4 1/2"', 'Abrasivos', 'material', 'un', 20),
  ('MAT-013', 'Parafuso sextavado 1/2"', 'Fixação', 'material', 'un', 100)
on conflict (code) do update set name = excluded.name, category = excluded.category, unit = excluded.unit,
  minimum_stock = excluded.minimum_stock, active = true;

-- Saldos atuais (fictícios). Alguns ficam abaixo do mínimo de propósito, para o alerta do Início.
with saldo(code, team, quantidade) as (values
  ('MAT-001', 'Almoxarifado Central', 12), ('MAT-002', 'Almoxarifado Central', 85), ('MAT-003', 'Almoxarifado Central', 40),
  ('MAT-004', 'Almoxarifado Central', 55), ('MAT-005', 'Almoxarifado Central', 14), ('MAT-006', 'Almoxarifado Central', 3),
  ('MAT-007', 'Almoxarifado Central', 60), ('MAT-008', 'Almoxarifado Central', 4), ('MAT-009', 'Almoxarifado Central', 120),
  ('MAT-010', 'Almoxarifado Central', 36), ('MAT-011', 'Almoxarifado Central', 18), ('MAT-012', 'Almoxarifado Central', 45),
  ('MAT-013', 'Almoxarifado Central', 400),
  ('MAT-002', 'Equipe Solda A', 18), ('MAT-009', 'Equipe Solda A', 25), ('MAT-007', 'Equipe Solda A', 12),
  ('MAT-013', 'Equipe Montagem B', 140), ('MAT-004', 'Equipe Montagem B', 22), ('MAT-010', 'Equipe Montagem B', 8))
insert into public.inventory (item_id, team_id, quantity)
select i.id, t.id, s.quantidade from saldo s join public.items i on i.code = s.code join public.teams t on t.name = s.team
on conflict (item_id, team_id) do update set quantity = excluded.quantity, updated_at = now();

delete from public.movements where movement_type = 'consumption' and note = 'Consumo fictício (semente 3L)';

select setseed(0.31);
with taxa(code, solda, montagem, chance) as (values
  ('MAT-002', 6, 4, 0.90), ('MAT-003', 3, 3, 0.70), ('MAT-004', 2, 4, 0.70), ('MAT-005', 1, 2, 0.35),
  ('MAT-006', 1, 1, 0.20), ('MAT-007', 3, 1, 0.60), ('MAT-012', 3, 2, 0.60), ('MAT-013', 0, 12, 0.40),
  ('MAT-001', 1, 1, 0.35), ('MAT-008', 1, 0, 0.30), ('MAT-009', 8, 3, 0.75), ('MAT-010', 0, 4, 0.35),
  ('MAT-011', 0, 2, 0.35)),
dias as (
  select d::date as dia, ((current_date - d::date) < 30) as recente
  from generate_series(current_date - 89, current_date, interval '1 day') d
  where extract(isodow from d) < 7),
equipes as (
  select id, name, (name = 'Equipe Solda A') as solda from public.teams where name in ('Equipe Solda A', 'Equipe Montagem B')),
sorteio as (
  select dias.dia, dias.recente, e.id as team_id, i.id as item_id,
         case when e.solda then taxa.solda else taxa.montagem end as base,
         taxa.chance * case when extract(isodow from dias.dia) = 6 then 0.5 else 1 end as chance,
         random() as r1, random() as r2, random() as r3
  from dias cross join equipes e join taxa on true join public.items i on i.code = taxa.code)
insert into public.movements (item_id, origin_team_id, destination_team_id, quantity, movement_type, note, performed_by, occurred_at)
select item_id, team_id, null,
       greatest(1, round(base * (0.5 + r2) * case when recente then 1.12 else 1 end))::int,
       'consumption', 'Consumo fictício (semente 3L)',
       (select id from public.profiles where role = 'admin' order by created_at limit 1),
       (dia + time '07:30' + (r3 * interval '9 hours')) at time zone 'America/Fortaleza'
from sorteio
where base > 0 and r1 < chance
  and (dia + time '07:30' + (r3 * interval '9 hours')) at time zone 'America/Fortaleza' < now();

-- Um funcionário fictício em apoio a outra equipe, para a tela "Funcionários em apoio" ter exemplo.
delete from public.employee_assignments where note = 'Apoio fictício (semente 3L)';
insert into public.employee_assignments (employee_id, team_id, starts_at, ends_at, note, created_by)
select e.id, t.id, now() - interval '3 days', (current_date + 12 + time '23:59') at time zone 'America/Fortaleza',
       'Apoio fictício (semente 3L)', (select id from public.profiles where role = 'admin' order by created_at limit 1)
from public.epi_employees e join public.teams t on t.name = 'Equipe Montagem B'
where e.full_name = 'Pedro Teste Lima' and e.active;

commit;
