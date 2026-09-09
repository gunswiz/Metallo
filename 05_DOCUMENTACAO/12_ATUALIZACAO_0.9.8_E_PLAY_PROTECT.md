# Atualização geral — Metallo 0.9.8 / Android build 49

Preparação local em 09/09/2026. A versão pública consultada nesta data permanece 0.9.7, build 48.

## O que foi preparado

- Web e Mobile identificados como versão 0.9.8; Android com build 49, superior ao instalado.
- Todas as funções Web incorporadas na etapa anterior estão incluídas. Consulte `11_FUNCOES_MOBILE_NO_WEB.md` para a lista e as limitações de homologação.
- Versão visível no menu do Web e na tela Minha conta do Mobile.
- Verificação e download de atualização pelo aplicativo preservados, com instruções sobre a confirmação de instalação do Android.
- O Mobile recusa manifesto com build não positivo ou endereço de APK que não corresponda à versão anunciada.
- A configuração Android recusa gerar release sem a chave e as credenciais oficiais, evitando produzir um APK sem a assinatura necessária à atualização.

## Publicação e atualização pelo aplicativo

`updates/proxima-versao.json` contém a versão candidata. `updates/latest.json` continua apontando para a versão já disponível. Não anuncie a candidata antes de o APK estar publicado.

O workflow Android foi preparado para executar esta sequência quando a tag `v0.9.8` for publicada:

1. Conferir versões do Web, Mobile, tag e manifesto.
2. Analisar e testar o aplicativo.
3. Compilar com os segredos de assinatura do GitHub Actions.
4. Validar o certificado permanente, preparar checksum e manifesto.
5. Criar release em rascunho com os artefatos e então publicá-la.
6. Baixar o APK público e comparar o SHA-256 com o artefato validado.
7. Atualizar apenas `updates/latest.json` na `main`, com verificação de concorrência por SHA e sem regredir o build; confirmar a leitura.

Assim os aplicativos existentes continuam consultando o mesmo endereço de atualização. Não precisam de uma versão intermediária para descobrir o build 49. A instalação continua exigindo confirmação do Android; não há instalação silenciosa.

Se a proteção da branch impedir a etapa 7, o APK poderá estar publicado sem ser anunciado. Nesse caso, a ativação precisa passar pelo fluxo permitido pela branch. Não remova a proteção para contornar o erro. Se uma execução falhar após criar a release, confira os artefatos existentes antes de repetir; o workflow não sobrescreve automaticamente uma release existente.

O Web mantém o workflow Cloudflare existente: depende da configuração `CLOUDFLARE_DEPLOY_ENABLED` e dos segredos do ambiente de produção. As compilações locais não comprovam a disponibilidade desses segredos.

## Aviso do Google mostrado na foto

O texto informa que o Play Protect nunca viu um aplicativo desse desenvolvedor. A foto, isoladamente, não identifica malware nem comprova um problema de assinatura. É um aviso sobre um desenvolvedor ainda desconhecido pelo Play Protect.

Foi inspecionado o APK público da versão 0.9.7:

| Propriedade | Resultado |
| --- | --- |
| Pacote | `com.gunswiz.metallo` |
| Versão / build | `0.9.7` / `48` |
| Assinatura | Válida, esquema APK v2 |
| Certificado SHA-256 | `5B95A774E9EED0699322EF35F5662BC37631D0F888D447320625A0CC5981827C` |
| Android mínimo / alvo | API 24 / API 36 |
| Permissões declaradas | Internet e permissão interna de receptor não exportado |
| SHA-256 do arquivo baixado | `E7005500D2B0C0FA221A16FB18F6C8C69EF444863C64D424965AC9D1C9C64223` |

Não foram encontradas nesse manifesto as permissões de SMS, leitura de notificações ou acessibilidade citadas pelo Google para um outro tipo de bloqueio. Esta inspeção de assinatura e manifesto não equivale a uma auditoria completa de segurança nem a aprovação do Google.

O certificado mantém a identidade técnica do aplicativo, mas não representa uma licença ou aprovação do Play Protect. A situação da conta de desenvolvedor no Google não foi verificada. Não é possível eliminar esse aviso apenas mudando o número da versão ou a assinatura; trocar a assinatura prejudicaria a atualização do app instalado.

Para tratar o aviso, mantenha a chave oficial e confira a verificação da identidade e o registro do pacote no console Android/Google Play apropriado. Quando o Google oferecer análise de segurança do APK, essa avaliação é feita pelo próprio Google. Se aparecer uma classificação de aplicativo nocivo que seja considerada equivocada após investigação, existe processo específico de contestação. Não foi enviada contestação nem alterada configuração do Play Protect nesta tarefa.

Fontes oficiais consultadas:

- [Orientações do Google sobre cada aviso do Play Protect](https://developers.google.com/android/play-protect/warning-dev-guidance).
- [Verificação de desenvolvedor Android](https://developer.android.com/developer-verification/guides).
- [Criação de releases pelo GitHub CLI](https://cli.github.com/manual/gh_release_create).
- [Atualização de conteúdo com SHA no GitHub](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents).

## Validação local

- Web: 49 testes aprovados; lint e TypeScript aprovados; builds Next e Vinext aprovados.
- Mobile: análise sem problemas; 39 testes aprovados.
- Publicação: 8 testes com API simulada aprovados, incluindo release ainda em rascunho, concorrência, versão divergente e prevenção de regressão.
- Workflow: sintaxe YAML validada localmente. O workflow remoto não foi executado.
- Assinatura: o planejamento de `assembleRelease` recusou a geração sem as credenciais oficiais, com o erro esperado.
- O APK de desenvolvimento usa `com.gunswiz.metallo.dev`; serve para teste separado e não substitui o APK oficial instalado.
- Aviso preexistente de compatibilidade futura do plugin `package_info_plus` com Kotlin continua presente; não impediu a compilação atual.

## Pendências para concluir a distribuição

A chave `metallo-release.jks` e as três credenciais Android não estão presentes no projeto/ambiente local. O workflow espera recebê-las dos segredos já configurados no GitHub. Não foi gerada uma chave substituta.

A publicação da versão 0.9.8 foi autorizada pelo usuário em 09/09/2026, substituindo a restrição anterior de manter o trabalho local. Commit, push, tag, release Android e deploy Web serão registrados no relatório de publicação; nenhuma alteração de dados ou migration remota faz parte desta distribuição.

Backup anterior à preparação: `C:\Projetos\Metallo-backups\ANTES_DA_ATUALIZACAO_20260909`.
