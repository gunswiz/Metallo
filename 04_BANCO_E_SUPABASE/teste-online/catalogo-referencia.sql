-- Catálogo de referência da produção (profissões, kits, itens-base, variantes, motivos, COSEM),
-- copiado das migrations 20260903001647 e 20260905032804. Só cadastro-base: nenhum dado de pessoa.
insert into public.epi_professions(code,name,uniform_color) values
('welder','Soldador','gray'),('helper','Ajudante','gray'),('assembler','Montador','gray'),
('painter','Pintor','gray'),('leader','Encarregado','blue')
on conflict(code) do update set name=excluded.name,uniform_color=excluded.uniform_color,active=true;

insert into public.epi_items(code,name,item_kind,unit,minimum_stock) values
('FARD-CINZA','Conjunto de farda cinza','uniform','conjunto',0),
('FARD-AZUL','Conjunto de farda azul','uniform','conjunto',0),
('EPI-CAP','Capacete de segurança','epi','un',0),
('EPI-OCU','Óculos de proteção','epi','un',0),
('EPI-AUR','Protetor auricular','epi','un',0),
('EPI-BOT','Botina de segurança','epi','par',0),
('EPI-LUV-RASPA','Luva de raspa','epi','par',0),
('EPI-MASC-SOLDA','Máscara de solda','epi','un',0),
('EPI-AVENTAL','Avental de raspa','epi','un',0),
('EPI-MANGOTE','Mangote de raspa','epi','par',0),
('EPI-RESP-PINT','Respirador para pintura','epi','un',0),
('EPI-LUV-NIT','Luva nitrílica','epi','par',0),
('EPI-MAC-PINT','Macacão para pintura','epi','un',0),
('PES-TRENA','Trena 5 m','personal_tool','un',0),
('PES-ESQ','Esquadro','personal_tool','un',0),
('PES-RISC','Riscador','personal_tool','un',0),
('PES-LAPIS','Lápis de carpinteiro','personal_tool','un',0),
('PES-BAT-SOLDA','Batedor de cascalho de solda','personal_tool','un',0)
on conflict(code) do update set name=excluded.name,item_kind=excluded.item_kind,unit=excluded.unit,active=true;

with kit(profession_code,item_code,qty) as (values
('welder','FARD-CINZA',2),('welder','EPI-CAP',1),('welder','EPI-OCU',1),('welder','EPI-AUR',1),('welder','EPI-BOT',1),('welder','EPI-LUV-RASPA',1),('welder','EPI-MASC-SOLDA',1),('welder','EPI-AVENTAL',1),('welder','EPI-MANGOTE',1),('welder','PES-BAT-SOLDA',1),
('helper','FARD-CINZA',2),('helper','EPI-CAP',1),('helper','EPI-OCU',1),('helper','EPI-AUR',1),('helper','EPI-BOT',1),('helper','EPI-LUV-RASPA',1),
('assembler','FARD-CINZA',2),('assembler','EPI-CAP',1),('assembler','EPI-OCU',1),('assembler','EPI-AUR',1),('assembler','EPI-BOT',1),('assembler','EPI-LUV-RASPA',1),('assembler','PES-TRENA',1),('assembler','PES-ESQ',1),('assembler','PES-RISC',1),('assembler','PES-LAPIS',1),
('painter','FARD-CINZA',2),('painter','EPI-CAP',1),('painter','EPI-OCU',1),('painter','EPI-AUR',1),('painter','EPI-BOT',1),('painter','EPI-RESP-PINT',1),('painter','EPI-LUV-NIT',1),('painter','EPI-MAC-PINT',1),
('leader','FARD-AZUL',2),('leader','EPI-CAP',1),('leader','EPI-OCU',1),('leader','EPI-AUR',1),('leader','EPI-BOT',1),('leader','EPI-LUV-RASPA',1),('leader','PES-TRENA',1),('leader','PES-ESQ',1),('leader','PES-RISC',1),('leader','PES-LAPIS',1)
)
insert into public.epi_profession_items(profession_code,item_id,recommended_quantity)
select kit.profession_code,i.id,kit.qty from kit join public.epi_items i on i.code=kit.item_code
on conflict(profession_code,item_id) do update set recommended_quantity=excluded.recommended_quantity;

insert into public.epi_professions(code, name, uniform_color, sort_order)
values
  ('welder', 'Soldador', 'gray', 10),
  ('helper', 'Ajudante', 'gray', 20),
  ('assembler', 'Montador', 'gray', 30),
  ('painter', 'Pintor', 'gray', 40),
  ('leader', 'Encarregado', 'blue', 50),
  ('munck_operator', 'Operador de Munck', 'gray', 60)
on conflict (code) do update set
  name = excluded.name,
  uniform_color = excluded.uniform_color,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();

with kit(profession_code, item_code, qty) as (values
  ('welder','FARD-CINZA',2), ('welder','EPI-CAP',1),
  ('welder','EPI-OCU',1), ('welder','EPI-AUR',1),
  ('welder','EPI-BOT',1), ('welder','EPI-LUV-RASPA',1),
  ('welder','EPI-MASC-SOLDA',1), ('welder','EPI-AVENTAL',1),
  ('welder','PES-BAT-SOLDA',1),
  ('helper','FARD-CINZA',2), ('helper','EPI-CAP',1),
  ('helper','EPI-OCU',1), ('helper','EPI-AUR',1),
  ('helper','EPI-BOT',1), ('helper','EPI-LUV-RASPA',1),
  ('assembler','FARD-CINZA',2), ('assembler','EPI-CAP',1),
  ('assembler','EPI-OCU',1), ('assembler','EPI-AUR',1),
  ('assembler','EPI-BOT',1), ('assembler','EPI-LUV-RASPA',1),
  ('assembler','PES-TRENA',1), ('assembler','PES-ESQ',1),
  ('assembler','PES-RISC',1),
  ('painter','FARD-CINZA',2), ('painter','EPI-CAP',1),
  ('painter','EPI-OCU',1), ('painter','EPI-AUR',1),
  ('painter','EPI-BOT',1), ('painter','EPI-RESP-PINT',1),
  ('leader','FARD-AZUL',2), ('leader','EPI-CAP',1),
  ('leader','EPI-OCU',1), ('leader','EPI-AUR',1),
  ('leader','EPI-BOT',1), ('leader','EPI-LUV-RASPA',1),
  ('leader','PES-TRENA',1), ('leader','PES-ESQ',1),
  ('leader','PES-RISC',1),
  ('munck_operator','FARD-CINZA',2), ('munck_operator','EPI-BOT',1),
  ('munck_operator','EPI-LUV-RASPA',1),
  ('munck_operator','EPI-AUR',1), ('munck_operator','EPI-OCU',1)
)
insert into public.epi_profession_items(
  profession_code, item_id, recommended_quantity
)
select k.profession_code, i.id, k.qty
from kit k
join public.epi_items i on i.code = k.item_code
on conflict (profession_code, item_id) do update set
  recommended_quantity = excluded.recommended_quantity;

with variants(item_code, value, label, sort_order) as (values
  ('EPI-BOT','38','Número 38',38), ('EPI-BOT','39','Número 39',39),
  ('EPI-BOT','40','Número 40',40), ('EPI-BOT','41','Número 41',41),
  ('EPI-BOT','42','Número 42',42), ('EPI-BOT','43','Número 43',43),
  ('EPI-BOT','44','Número 44',44), ('EPI-BOT','45','Número 45',45),
  ('EPI-BOT','46','Número 46',46),
  ('EPI-OCU','Claro','Lente clara',10),
  ('EPI-OCU','Escuro','Lente escura',20),
  ('FARD-CINZA','M','Tamanho M',10), ('FARD-CINZA','G','Tamanho G',20),
  ('FARD-CINZA','GG','Tamanho GG',30), ('FARD-CINZA','XG','Tamanho XG',40),
  ('FARD-CINZA','XXG','Tamanho XXG',50),
  ('FARD-AZUL','M','Tamanho M',10), ('FARD-AZUL','G','Tamanho G',20),
  ('FARD-AZUL','GG','Tamanho GG',30), ('FARD-AZUL','XG','Tamanho XG',40),
  ('FARD-AZUL','XXG','Tamanho XXG',50)
)
insert into public.epi_item_variants(item_id, value, label, sort_order)
select i.id, v.value, v.label, v.sort_order
from variants v
join public.epi_items i on i.code = v.item_code
on conflict (item_id, value) do update set
  label = excluded.label,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();

insert into public.operation_reasons(scope, code, label, sort_order)
values
  ('epi_delivery','initial','Primeira entrega',10),
  ('epi_delivery','replacement','Substituição',20),
  ('epi_delivery','additional','Entrega adicional',30),
  ('epi_close','returned','Devolvido',10),
  ('epi_close','damaged','Danificado',20),
  ('epi_close','lost','Perdido',30),
  ('epi_close','consumed','Consumido',40),
  ('epi_close','replaced','Substituído',50),
  ('equipment_transfer','team_transfer','Transferência entre equipes',10),
  ('equipment_transfer','location_change','Mudança de local',20),
  ('equipment_return','partial_return','Devolução parcial',10),
  ('equipment_return','contract_end','Fim do contrato',20),
  ('equipment_return','work_reduction','Redução da obra',30),
  ('equipment_return','defect_exchange','Troca por defeito',40)
on conflict (scope, code) do update set
  label = excluded.label,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();

insert into public.work_locations(name, location_type, notes)
values ('COSEM', 'warehouse', 'Centro de estoque e distribuição')
on conflict (lower(name)) do update set
  location_type = excluded.location_type,
  notes = excluded.notes,
  active = true,
  updated_at = now();
select 'catalogo ok' as status;
