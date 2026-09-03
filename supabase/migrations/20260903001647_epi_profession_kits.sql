create table public.epi_professions (
  code text primary key,
  name text not null unique,
  uniform_color text not null check (uniform_color in ('gray','blue')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.epi_profession_items (
  profession_code text not null references public.epi_professions(code) on delete cascade,
  item_id uuid not null references public.epi_items(id) on delete cascade,
  recommended_quantity integer not null default 1 check (recommended_quantity > 0),
  primary key (profession_code, item_id)
);

alter table public.epi_professions enable row level security;
alter table public.epi_profession_items enable row level security;

create policy epi_professions_read on public.epi_professions for select to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','engineer')));
create policy epi_professions_admin_write on public.epi_professions for all to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role='admin'))
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role='admin'));
create policy epi_profession_items_read on public.epi_profession_items for select to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','engineer')));
create policy epi_profession_items_admin_write on public.epi_profession_items for all to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role='admin'))
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role='admin'));

grant select,insert,update,delete on public.epi_professions,public.epi_profession_items to authenticated;

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
