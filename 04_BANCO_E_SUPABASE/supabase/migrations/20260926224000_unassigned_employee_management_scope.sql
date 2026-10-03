-- T-05: equipe NULL nao equivale a autorizacao global da Gestao.
-- Incremental, somente laboratorio. Nao altera can_operate nem o DTO pessoal.
-- Admin global conserva seu acesso; os demais exigem equipe atribuida.
alter policy epi_employees_read on public.epi_employees using (
  public.is_active_admin() or (
    team_id is not null and (
      public.can_operate('epi:write', team_id) or (
        public.employee_work_team(id) is not null and
        public.can_operate('epi:write', public.employee_work_team(id))
      )
    )
  )
);

-- Historico continua visivel por sua propria equipe autorizada. A alternativa
-- de equipe atual do funcionario so pode ampliar o recorte com um ID explicito.
alter policy epi_deliveries_read on public.epi_deliveries using (
  public.can_operate('epi:write', team_id) or (
    public.employee_work_team(employee_id) is not null and
    public.can_operate('epi:write', public.employee_work_team(employee_id))
  )
);
alter policy assignments_read on public.employee_assignments using (
  public.can_operate('epi:write', team_id) or (
    public.employee_work_team(employee_id) is not null and
    public.can_operate('epi:write', public.employee_work_team(employee_id))
  )
);

-- As RPCs DEFINER de EPI ignoram RLS. Guardar tambem a fronteira de escrita:
-- entrega simples/lote, pedido, atendimento e fechamento, inclusive via roteador.
-- A guarda complementa as permissoes atuais; nao concede direito a nenhum ator.
-- A excecao aborta toda a transacao, incluindo eventual baixa previa de estoque.
create or replace function private.guard_unassigned_employee_operation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_ids uuid[] := array[]::uuid[];
  v_employee_id uuid;
  v_team_id uuid;
begin
  if not public.is_active_admin() then
    if tg_op <> 'INSERT' then v_ids := array_append(v_ids, old.employee_id); end if;
    if tg_op <> 'DELETE' then v_ids := array_append(v_ids, new.employee_id); end if;
    for v_employee_id in select distinct unnest(v_ids) loop
      -- Impedir que a equipe seja retirada concorrentemente durante a escrita.
      select e.team_id into v_team_id from public.epi_employees e
        where e.id = v_employee_id for share;
      if found and v_team_id is null then
        raise exception 'unassigned_employee_admin_required' using errcode = '42501';
      end if;
    end loop;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.guard_unassigned_employee_operation()
  from public, anon, authenticated;

drop trigger if exists guard_unassigned_employee_operation on public.epi_deliveries;
create trigger guard_unassigned_employee_operation
before insert or update or delete on public.epi_deliveries
for each row execute function private.guard_unassigned_employee_operation();

drop trigger if exists guard_unassigned_employee_operation on public.epi_requests;
create trigger guard_unassigned_employee_operation
before insert or update or delete on public.epi_requests
for each row execute function private.guard_unassigned_employee_operation();
