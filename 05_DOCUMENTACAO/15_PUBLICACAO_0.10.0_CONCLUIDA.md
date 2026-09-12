# Metallo 0.10.0 — publicação concluída

Publicação autorizada pelo usuário e concluída em 12/09/2026. As instruções de uso de cada função estão em [14_OBRAS_PERMISSOES_E_EPI_INDIVIDUAL.md](14_OBRAS_PERMISSOES_E_EPI_INDIVIDUAL.md).

## Acessos e primeiros passos

- [Metallo Web](https://metallo-web.metallo-gunswiz.workers.dev)
- [APK oficial 0.10.0](https://github.com/gunswiz/Metallo/releases/download/v0.10.0/Metallo.apk)
- [Release e notas](https://github.com/gunswiz/Metallo/releases/tag/v0.10.0)

No aplicativo instalado: **Minha conta → Verificar atualização**. O manifesto público anuncia **0.10.0, build 50**. O APK mantém o certificado das versões oficiais anteriores.

No web, abra **Obras e pedidos** no menu lateral. No mobile, toque no **ícone de obra/construção na barra superior**. A ADM deve cadastrar as obras, vincular equipes e definir as permissões dos responsáveis. Os lotes anteriores de EPI permanecem centrais até que sua transferência seja registrada.

## Evidências da publicação

| Verificação | Resultado |
| --- | --- |
| Commit da versão / tag | `5ccc8b85b6d0502be5904ef26b96e8a4408bb4f0` / `v0.10.0` |
| Commit que ativou o manifesto | `1f1e777bae524125e9c5a635d3d3ad09c691c615` |
| Pacote do APK público | `com.gunswiz.metallo` |
| Versão / build lidos com aapt | `0.10.0` / `50` |
| Tamanho do APK | 66.286.683 bytes |
| Certificado SHA-256, conferido com apksigner | `5B95A774E9EED0699322EF35F5662BC37631D0F888D447320625A0CC5981827C` |
| SHA-256 do APK baixado | `F090A062CF9AA4ACF0A217EE3820CFCFC5157466BB91D8F174C34A3960E042EB` |
| Checksum publicado e manifesto público | Iguais aos arquivos verificados localmente |
| Versão Cloudflare final | `6b3f253c-928b-4dff-a327-9690ce563ddf` |
| Login, CSS e JavaScript públicos | HTTP 200 |
| Obras, usuários e funcionários sem sessão | HTTP 307 para login |
| Serviço create-employee | ACTIVE, versão 13, verificação JWT habilitada |

- [Workflow Web: qualidade e deploy aprovados](https://github.com/gunswiz/Metallo/actions/runs/34681418315).
- [Conferência final após a correção da automação: qualidade e deploy aprovados](https://github.com/gunswiz/Metallo/actions/runs/34681793587), commit `652a84a`. Inclui os 27 testes de banco, cadastro e publicação. O endereço padrão do manifesto, sem parâmetro adicional, também foi consultado e confirmou o build 50.
- [Workflow Android: build, testes, assinatura e publicação do APK aprovados](https://github.com/gunswiz/Metallo/actions/runs/34681419273). A última etapa gravou o manifesto, mas marcou falha ao reler imediatamente a referência `main`, que retornou o conteúdo anterior. A ativação foi confirmada depois pelo commit e pelo manifesto público. A conferência foi corrigida para ler o commit imutável retornado pela gravação, com dois testes de regressão. O APK publicado não foi substituído.

## Banco e preservação

Foram aplicadas as migrations `20260912073507_user_operation_permissions` e `20260912073518_site_operations`.

As contagens e os hashes do conteúdo anterior de 12 tabelas foram iguais antes e depois: profiles, teams, items, inventory, assets, movements, asset_movements, epi_employees, epi_items, epi_deliveries, epi_stock_batches e epi_requests. A comparação excluiu somente as novas colunas previstas nas migrations. Novas datas históricas foram preenchidas com a data de registro anterior; o sistema não conhece o horário real de fatos antigos.

As verificações remotas usaram consultas e uma transação de leitura com rollback, sem criar pedidos, funcionários, estoque ou entregas reais para testar. Casos completos de negócio foram executados com dados fictícios em PostgreSQL incorporado localmente.

Os advisors não apontaram novas tabelas expostas sem RLS nem chaves estrangeiras sem índice. Permanecem avisos anteriores sobre índices duplicados, políticas permissivas sobrepostas e proteção de senhas vazadas desativada. As funções com SECURITY DEFINER são chamadas autenticadas intencionais e verificam autorização; os testes cobrem permissões, escopo de equipe e ADM. Os três avisos de RLS sem política correspondem a tabelas privadas de backup, sem acesso concedido. Referências: [funções autenticadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [proteção de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Testes e limites

- Web: 58 testes aprovados, lint, TypeScript, build Next e compatibilidade Cloudflare.
- Mobile: 45 testes aprovados, Flutter analyze sem problemas e builds debug/release. Flutter 3.47.2.
- Banco, cadastro e publicação: 27 testes aprovados, incluindo 15 testes de integração PostgreSQL e dois novos casos da confirmação de publicação.
- PDFs individuais web/mobile: amostras fictícias de 70 linhas e 140 unidades; páginas renderizadas e inspeção visual de cabeçalhos, itens, C.A., totais e assinaturas.
- APK público baixado e inspecionado; instalação em aparelho físico e eventual aviso do Play Protect não foram testados nesta entrega.
- A fila sem internet se aplica à nova área Obras e pedidos, conforme o guia. As telas antigas e a geração de PDF exigem conexão. Alertas ficam dentro do Metallo, somente para ADM.

A mesma assinatura mantém a compatibilidade de atualização com o aplicativo oficial anterior; isso não equivale à aprovação do Google Play Protect.

## Cópias e recuperação

Backup anterior: `C:\Projetos\Metallo-backups\ANTES_0.10.0_20260912`, com histórico Git, alterações, novos arquivos e schema anterior. Não é um dump dos dados de produção.

Evidências locais de preservação, advisors, consulta pública e PDFs: `C:\Users\welli\Documents\Codex\2026-09-08\vo\outputs\metallo-validacao`. APK oficial e sua verificação: `outputs\metallo-0.10.0-oficial` na mesma pasta da tarefa.

A versão Cloudflare anterior era `6f25098c-2b21-48c9-80eb-f5f9d85f19f9`. A release 0.9.8 continua no GitHub. Correções Android devem usar build superior a 50; não sobrescrever o APK publicado. Não remover as novas tabelas para reverter telas: operações registradas após a atualização devem ser preservadas.
