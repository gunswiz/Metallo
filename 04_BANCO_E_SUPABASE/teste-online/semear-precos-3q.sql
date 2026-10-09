-- Marco 3Q: preços FICTÍCIOS para demonstrar o consumo em R$ (parafuso e escova ficam sem preço de propósito).
with adm as (select id from public.profiles where role = 'admin' and active order by created_at limit 1),
p(code, price) as (values ('MAT-002',9.90),('MAT-009',24.50),('MAT-003',14.90),('MAT-004',8.50),('MAT-007',3.20),('MAT-012',4.90),
  ('MAT-001',89.00),('MAT-005',18.00),('MAT-008',129.00),('MAT-011',32.00),('MAT-010',45.00))
insert into private.item_prices_3q(item_id, unit_price, updated_by)
select i.id, p.price, adm.id from p join public.items i on i.code = p.code cross join adm
on conflict (item_id) do nothing;
