# 50 · Ambiente de teste online (metallo-teste)

**Situação:** criado em 03/10/2026. Dados **100% fictícios**. Sem valor oficial. Separado da produção.

## O que é

| Peça | Teste online | Produção (não muda) |
|---|---|---|
| Banco | Supabase `metallo-teste` (`cvimwiqokkujfhwynhmt`, São Paulo, plano grátis) | Supabase `Almoxarifado Online` (pausado, intocado) |
| Gestão | Worker `metallo-teste-gestao` | Worker `metallo-web` |
| Colaborador | Worker `metallo-teste-colaborador` | ainda não publicado |
| Publicação | `.github/workflows/teste-online.yml`, só na branch `laboratorio-colaborador` | `.github/workflows/web.yml`, só na `main` |

## Como o banco foi montado

1. Esquema `public` + `private` copiado do laboratório (estado após o Marco 3I), com as mesmas permissões e regras de RLS.
   Conferência objeto a objeto (funções, tabelas, políticas, índices, gatilhos, permissões): 809/809 iguais; diferenças só de espaços em branco e parênteses.
2. Gatilhos de criação de conta no Auth e publicação Realtime iguais aos do laboratório.
3. Catálogo-base da produção (`teste-online/catalogo-referencia.sql`): profissões, kits, itens-base, variantes, motivos e COSEM.
4. Dados fictícios (`teste-online/semear-teste-online.mjs`): 1 gestor, 3 colaboradores com acesso (João, Maria, Pedro), 2 sem acesso,
   2 equipes com obra, entregas de EPI (confirmada, pendente e com recusa registrada), itens pessoais, comunicados, materiais e equipamentos (próprio e alugado).
5. Conferência pela API pública (`teste-online/conferir-teste-online.mjs`): colaborador só vê os próprios dados; tabelas e funções da Gestão retornam vazio; sem login retorna 401.

Senhas das contas fictícias: `backups/credenciais-teste-online.json` (fora do Git).

## Travas de segurança no código

- `09_CONFIGURACOES/ambiente-teste-online.ts` fixa os dois únicos endereços aceitos: laboratório (`127.0.0.1:54321`) e teste online.
  Nenhuma variável consegue apontar o Colaborador ou os recursos novos para a produção.
- O Colaborador online só aceita chave **publicável** (`sb_publishable_…`), nunca secreta; só fala com as RPCs pessoais da lista fechada.
- Recursos novos (EPI 3D–3I, comunicados, itens pessoais) continuam desligados na produção.
- Testes: `10_TESTES/teste-online.test.ts` (10 casos).

## Atualização 04/10/2026

- **Biometria do celular na entrega de EPI (3F)** também no teste online: Edge Function `assinatura-epi-3f` (RP = Colaborador de teste). Provas com autenticador virtual: 27/27 (`teste-online/provas-3f-online.mjs`).
- **Meu Ponto online** (Marco 4D): ver documento 51.
- Ficha de EPI em PDF funcionando no Worker (logo embutido; antes dava 503).
- Profissão aparece pelo nome (Soldador, Montador…) e não pelo código do cadastro.
- Edge Functions usam o pooler em modo transação (o banco grátis aceita só 60 conexões diretas).
- Dados da demonstração recriados do zero (mesmas senhas). As provas automáticas usam a conta "Robô de Provas Automáticas".
- Para limpar e semear de novo: `migrar limpar-dados-teste-online.sql` → `migrar ponto-4d.sql` → `teste-online semear-teste-online.mjs`.

## Ferramenta temporária

A função `migrador-temporario` (Edge Function protegida por JWT + token local + prazo até 06/10/2026) foi usada para aplicar o esquema e semear.
Deve ser desativada (substituída por um stub que só responde 410) quando o teste online estiver aprovado.

## Redesign integrado — prévia de 15/10/2026

**Situação:** integrado ao código funcional, disponível localmente para avaliação. Esta alteração ainda não foi publicada. A aprovação manual da prévia, a auditoria independente prevista no `AGENTS.md` e a autorização desta publicação continuam pendentes.

- Gestão: `http://127.0.0.1:3102/login`; após entrar, `/dashboard`, `/materiais` e os demais módulos existentes.
- Funcionário: `http://127.0.0.1:3101/colaborador/login`; após entrar, `/colaborador/inicio` e as vinte entradas do menu pessoal.
- Utiliza as contas e os dados fictícios do **metallo-teste**. Os formulários continuam funcionais; operações enviadas pela prévia alteram o teste online. A inspeção desta entrega usou login e consultas, sem enviar pedidos, marcar ponto ou modificar cadastros.

Para reiniciar, executar na raiz do projeto, em dois terminais:

```powershell
powershell -NoProfile -File .\07_CONFIGURACOES_DO_PROJETO\iniciar-previa-redesign.ps1 -Area gestao
powershell -NoProfile -File .\07_CONFIGURACOES_DO_PROJETO\iniciar-previa-redesign.ps1 -Area colaborador
```

O componente compartilhado `01_WEB/02_COMPONENTES_VISUAIS/Galpao/login-galpao.tsx` incorpora o galpão aprovado da proposta: 12 módulos, travamentos, escada amarela na frente, descida pela platibanda e linhas de vida. A cena mantém montagem, giro, aproximação e navegação interna. Ela só carrega no login e é desmontada ao sair. Uma falha da cena não bloqueia o formulário.

A apresentação reutiliza as telas, permissões, formulários, sessões e serviços existentes. A Gestão recebe o tema da proposta, menus e tabelas; o Funcionário recebe navegação lateral no computador e atalhos inferiores no celular. Funcionário sem equipe continua com a apresentação **Sem equipe atribuída**, sem ampliar permissões da Gestão.

O acesso local ao backend do teste exige `NODE_ENV=development`, a opção explícita `NEXT_PUBLIC_METALLO_TESTE_PREVIEW=1` e a origem fixa `http://127.0.0.1:3101`. O servidor de prévia escuta apenas em `127.0.0.1`. As consultas de ponto validam Host/Origin locais, sessão e caminhos permitidos antes de encaminhar para o endereço HTTPS fixo do teste. Em produção, a opção não libera HTTP local. Nenhuma migration, mudança de Auth ou alteração de configuração remota faz parte desta entrega.

Validação: 507 testes em 66 arquivos; TypeScript e ESLint sem erros; compilação Vinext concluída. Conferência no navegador com as contas fictícias de gestor e João, catálogo de materiais, EPIs, relógio e consulta das marcações, menu móvel e formulário de pedido em largura de 320 px. Rótulos responsivos de Início e Materiais são renderizados pelo servidor para evitar divergência na hidratação. Capturas de avaliação em `outputs/Metallo-Teste-Login.jpg`, `outputs/Metallo-Teste-Gestao.jpg` e `outputs/Metallo-Teste-Funcionario.jpg`.
