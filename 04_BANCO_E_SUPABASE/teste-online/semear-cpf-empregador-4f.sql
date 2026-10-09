-- Marco 4F: dados FICTÍCIOS para o teste online (CNPJ de exemplo e CPFs gerados só para teste, com dígito válido).
insert into private.empregador_4f(singleton, tipo_documento, documento, razao_social, local_prestacao, inpi, desenvolvedor_documento)
values (true, 1, '11222333000181', 'METALLO TESTE LTDA (EMPRESA FICTICIA)', 'Obra de teste - Fortaleza/CE', null, '11222333000181')
on conflict (singleton) do nothing;
insert into private.employee_cpf_4f(employee_id, cpf)
select e.id, v.cpf from (values ('TESTE-001','10433218100'),('TESTE-002','96001338914'),('TESTE-003','08386379499'),
  ('TESTE-004','02654235114'),('TESTE-005','16155940789'),('TESTE-006','81618495950')) v(code, cpf)
join public.epi_employees e on e.registration_code = v.code
on conflict (employee_id) do nothing;
