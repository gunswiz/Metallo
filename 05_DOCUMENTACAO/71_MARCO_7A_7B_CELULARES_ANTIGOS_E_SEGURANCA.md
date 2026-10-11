# Marcos 7A e 7B — Celulares antigos e revisão de segurança (Bloco 4)

Ambiente: TESTE ONLINE. Produção não foi tocada — **tudo daqui precisa ir junto quando publicar**.

## Correção do contracheque (11/10)
O PDF "não abria" porque o arquivo de teste que eu tinha enviado era um PDF falso (só o cabeçalho, sem página).
O envio, o download e a abertura estavam certos. Coloquei um contracheque de teste de verdade para o João (setembro/2026,
`teste-online/arquivos-ficticios/contracheque-teste-joao-2026-09.pdf`, script `semear-contracheque-joao.mjs`).

## 7A — Celular antigo
- **Código convertido para Chrome 87+** (`vite.config.ts`, `build.target`): Android 7 com Chrome sem atualização recente consegue rodar.
- **`public/compat-antigos.js`** (JavaScript antigo, roda antes do app): completa `AbortSignal.any` (Chrome 116),
  `AbortSignal.timeout` (103), `.at()` (92), `Object.hasOwn` (93), `crypto.randomUUID` (92), `structuredClone` (98), `replaceAll` (85).
  Sem isso, **toda chamada do app falhava** em Chrome anterior ao 116 (o `portalFetch` usa `AbortSignal.any`).
- Navegador antigo demais: aparece o aviso "atualize o Google Chrome na Play Store" em vez de tela branca.
- Menu lateral do app: alternativa para quem não entende `dvh`/`color-mix` (Chrome < 108/111).
- Foto do atestado já é reduzida no celular (6B). Envio de arquivo com até 90 s (internet fraca).
- Limite conhecido: telas da Gestão no celular usam `:has()` (Chrome 105+) para empilhar linhas; em Chrome mais antigo fica mais apertado (funciona).

## 7B — Segurança
| Achado | Gravidade | O que foi feito |
|---|---|---|
| Gestão **sem nenhum cabeçalho de proteção** (podia ser aberta dentro de outro site; sem política de conteúdo; sem HTTPS obrigatório) | Alta | `proxy.ts` → `cabecalhosGestao`: CSP, `frame-ancestors 'none'`, `X-Frame-Options`, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy` |
| App do funcionário sem `X-Frame-Options`/`Permissions-Policy` | Baixa | Adicionados (localização e câmera só do próprio site) |
| `next` 16.3.4 com falhas (1 crítica: `next/og`; não usamos, mas corrigido) | Alta | `next` e `eslint-config-next` 16.3.8 |
| Bibliotecas indiretas com falhas (undici, brace-expansion, sharp, source-map-js, fast-uri) | Alta/Média | `overrides` no `pnpm-workspace.yaml` |
| `braces` 3.0.3 (só ferramentas de desenvolvimento; não há versão corrigida) | Baixa | Acompanhar |
| Papel `anon` (quem não entrou) com permissão de tabela em 14 tabelas antigas, inclusive TRUNCATE | Média | `7b-seguranca-permissoes.sql`: tudo retirado; padrão para tabelas novas também |
| `authenticated` com TRUNCATE/TRIGGER/REFERENCES | Baixa | Retirado |
| Funções internas do ponto executáveis por `anon` | Baixa | Só `authenticated` |
| 139 funções do banco "executáveis por quem entrou" (aviso do Supabase) | Esperado | Conferido: **todas** checam a permissão por dentro (admin, equipe ou o próprio funcionário) |
| `pg_net` no esquema public | Baixa | Na produção, instalar em `extensions` |
| Proteção contra senha vazada (HaveIBeenPwned) desligada | Média | Recurso do plano pago — ligar na produção; senha `12345678` só no teste |
| Segredos no repositório | — | Nenhum segredo real encontrado (só exemplos sintéticos nos testes) |
| Balde de arquivos | — | Privado, sem regra de acesso direto; tudo pela função `arquivos-6` |

## Provas
- Testes web: 63 arquivos, 485 testes, typecheck e lint limpos (`celulares-antigos-seguranca-7.test.ts`).
- Provas online repetidas depois da mudança de permissões: 4K 33/33, 4L 22/22, 5B 22/22, 6 32/32, 4F 22/22 (ajustada para aceitar marcação sem internet), 4G 17/17, 4H 12/12, 4I 15/15, 3T 13/13.
- Auditoria de dependências (`tmp/auditoria-dependencias.mjs`): de 28 achados para 1 (braces, sem correção publicada).
