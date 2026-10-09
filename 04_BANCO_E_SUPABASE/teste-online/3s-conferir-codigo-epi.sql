-- Marco 3S (TESTE ONLINE): conferir o "Código de verificação" impresso no PDF de EPI.
-- Quem tem o código em mãos (ex.: na ficha impressa) consegue ver a quem pertence a confirmação e se o conteúdo continua íntegro.
create or replace function public.conferir_codigo_epi_3s(p_codigo text)
returns table(forma text, confirmado_em timestamptz, funcionario text, matricula text, entregue_em text, itens jsonb, integro boolean)
language plpgsql stable security definer set search_path = '' as $$
declare v_hash text := lower(regexp_replace(coalesce(p_codigo, ''), '[^0-9A-Fa-f]', '', 'g'));
begin
  if not exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active) then raise exception 'gestao_required' using errcode = '42501'; end if;
  if v_hash !~ '^[0-9a-f]{64}$' then raise exception 'codigo_invalido' using errcode = '22023'; end if;
  return query
    select x.forma, x.quando, e.full_name, e.registration_code, (x.c::jsonb)->>'delivered_at', (x.c::jsonb)->'items',
      encode(pg_catalog.sha256(convert_to(x.c, 'UTF8')), 'hex') = v_hash
    from (
      select 'digital'::text forma, s.verified_at quando, s.employee_id, s.payload_canonical c from private.epi_signature_events_3f s where s.payload_hash = v_hash
      union all
      select 'senha', c.verified_at, c.employee_id, c.payload_canonical from private.epi_confirmacao_senha_3j c where c.payload_hash = v_hash
    ) x join public.epi_employees e on e.id = x.employee_id
    limit 1;
end $$;
revoke all on function public.conferir_codigo_epi_3s(text) from public, anon;
grant execute on function public.conferir_codigo_epi_3s(text) to authenticated;
select '3S pronto' as status;
