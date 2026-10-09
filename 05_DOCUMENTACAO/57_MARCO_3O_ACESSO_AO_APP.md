# Marco 3O — Gestão cria o acesso do funcionário ao app (08/10/2026)

Teste online, dados fictícios. Produção intocada.

- Tela **Pessoas › Acesso ao app** (`/acesso-app`, só administrador): lista funcionários com a situação (Sem acesso, Com acesso, Bloqueado),
  usuário e último acesso. Ações: **Criar acesso** (usuário sugerido "nome.sobrenome", senha sugerida de 8 números), **Nova senha**
  (encerra as sessões abertas) e **Bloquear acesso** (motivo; sai do app na hora; histórico preservado). Bloqueado pode receber novo login.
- Exige matrícula cadastrada (o vínculo confere nome + matrícula). A Gestão deve conferir a identidade pessoalmente.
- Servidor: Edge Function `acesso-funcionario` (verify_jwt; só admin ativo; service role só dentro da função). Usa as regras existentes:
  `issue_user_provisioning_ticket`, conta própria do app (`metallo_account_type=employee_portal`, perfil inativo na Gestão),
  `admin_register_portal_account`, `admin_link_employee_identity` (in_person) e `admin_revoke_employee_identity` + bloqueio no Auth.
- App: login mostra "Esqueceu a senha? Peça ao escritório…" (a troca é feita pela Gestão).
- Provas online `teste-online/provas-3o-online.mjs`: **17/17**. Testes web `10_TESTES/acesso-app-3o.test.ts`.
- Produção: definir o domínio dos logins (`METALLO_DOMINIO_LOGIN`) e o endereço do app antes de publicar.
