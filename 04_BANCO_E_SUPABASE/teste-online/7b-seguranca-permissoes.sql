-- Marco 7B (Bloco 4 — revisão de segurança), TESTE ONLINE. Levar igual para a produção.
-- 1) O papel "anon" (quem não entrou) ainda tinha permissão de tabela em 14 tabelas antigas (inclusive INSERT/UPDATE/DELETE e TRUNCATE).
--    O RLS já bloqueava as linhas (as regras são só para quem entrou), mas TRUNCATE não passa pelo RLS. Tirar tudo de "anon".
-- 2) Quem entrou ("authenticated") não precisa de TRUNCATE, TRIGGER nem REFERENCES em tabela nenhuma.
-- 3) Funções internas do ponto e do 3J: tirar de PUBLIC (inclui anon) e devolver só para authenticated.
revoke all on all tables in schema public from anon;
revoke truncate, trigger, references on all tables in schema public from authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke truncate, trigger, references on tables from authenticated;
revoke execute on function private.imutavel_3j(), ponto.afd_dh(timestamp with time zone), ponto.afd_linha7(ponto.marcacao), ponto.afd_latin1(text), ponto.afd_a(text, integer), ponto.afd_n(text, integer), ponto.crc16_kermit(text), ponto.canonico_hora(ponto.conferencia_hora), ponto.hora_atual_4j() from public;
grant execute on function private.imutavel_3j(), ponto.afd_dh(timestamp with time zone), ponto.afd_linha7(ponto.marcacao), ponto.afd_latin1(text), ponto.afd_a(text, integer), ponto.afd_n(text, integer), ponto.crc16_kermit(text), ponto.canonico_hora(ponto.conferencia_hora), ponto.hora_atual_4j() to authenticated;
