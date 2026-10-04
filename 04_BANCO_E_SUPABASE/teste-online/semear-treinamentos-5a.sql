-- Marco 5A — dados FICTÍCIOS de treinamentos e ASO para o teste online. Rodar depois do contrato 5A.
begin;
insert into private.profession_trainings_5a(profession,type_code) values
  ('welder','NR35'),('welder','NR06'),('assembler','NR35'),('assembler','NR18'),('helper','NR18'),('helper','NR06'),
  ('painter','NR35'),('leader','NR35'),('leader','NR18'),('munck_operator','NR11'),('munck_operator','NR35')
on conflict do nothing;
with gestor as (select id from public.profiles where role='admin' and active order by created_at limit 1),
emp as (select id, full_name, profession, row_number() over (order by full_name) n from public.epi_employees where active)
update public.epi_employees e set
  aso_exam_date = (private.hoje_5a() - (case emp.n % 4 when 0 then 400 when 1 then 300 when 2 then 340 else 60 end))::date,
  aso_expiry_date = (private.hoje_5a() - (case emp.n % 4 when 0 then 400 when 1 then 300 when 2 then 340 else 60 end) + 365)::date
from emp where emp.id = e.id and e.aso_expiry_date is null;
-- Treinamentos: alguns em dia, alguns vencendo em até 30 dias, alguns vencidos, alguns faltando.
with gestor as (select id from public.profiles where role='admin' and active order by created_at limit 1),
emp as (select id, profession, row_number() over (order by full_name) n from public.epi_employees where active),
plano as (
  select emp.id employee_id, pt.type_code, emp.n, row_number() over (partition by emp.id order by pt.type_code) k
  from emp join private.profession_trainings_5a pt on pt.profession = emp.profession
)
insert into private.employee_trainings_5a(idempotency_key, employee_id, type_code, completed_on, expires_on, provider, workload_hours, created_by)
select gen_random_uuid(), p.employee_id, p.type_code,
  (private.hoje_5a() - (case (p.n + p.k) % 3 when 0 then 700 when 1 then 715 else 200 end))::date,
  case when t.validity_months is null then null
    else (private.hoje_5a() - (case (p.n + p.k) % 3 when 0 then 700 when 1 then 715 else 200 end) + make_interval(months => t.validity_months))::date end,
  'Centro de Treinamento Fictício', 8, (select id from gestor)
from plano p join private.training_types_5a t on t.code = p.type_code
where (p.n + p.k) % 5 <> 0
  and not exists (select 1 from private.employee_trainings_5a x where x.employee_id = p.employee_id and x.type_code = p.type_code);
select jsonb_build_object('ok', true, 'treinamentos', (select count(*) from private.employee_trainings_5a),
  'situacoes', (select jsonb_object_agg(s, c) from (select private.ficha_5a(id)->>'situacao' s, count(*) c from public.epi_employees where active group by 1) x)) resultado;
commit;
