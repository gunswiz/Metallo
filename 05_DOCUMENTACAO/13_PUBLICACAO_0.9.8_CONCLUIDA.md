# Metallo 0.9.8 — publicação concluída

Publicação autorizada pelo usuário e concluída em 09/09/2026.

## Acessos

- [Metallo Web](https://metallo-web.metallo-gunswiz.workers.dev)
- [APK oficial 0.9.8](https://github.com/gunswiz/Metallo/releases/download/v0.9.8/Metallo.apk)
- [Release e notas](https://github.com/gunswiz/Metallo/releases/tag/v0.9.8)

No aplicativo instalado, abra **Minha conta → Verificar atualização**. O manifesto público já anuncia a versão 0.9.8, build 49. Depois do download, abra o APK e confirme a atualização no Android. A mesma assinatura permite atualizar a instalação oficial anterior sem desinstalá-la.

## Evidências

| Verificação | Resultado |
| --- | --- |
| Commit da versão / tag | `a634ed2b327d1e150d1d9a3d78a50333f131230d` / `v0.9.8` |
| Commit de ativação do manifesto | `56b9815` |
| Pacote do APK público | `com.gunswiz.metallo` |
| Versão / build confirmados no APK | `0.9.8` / `49` |
| Certificado SHA-256 | `5B95A774E9EED0699322EF35F5662BC37631D0F888D447320625A0CC5981827C` — igual à versão anterior |
| SHA-256 do APK público | `7750CA41551404F0E13F3350989A091A801FE701710C152269EF1EE3FDAB7586` |
| Checksum publicado | Igual ao arquivo baixado e verificado localmente |
| Manifesto público | `0.9.8`, build `49`, URL oficial do APK |
| Última versão Cloudflare conferida | `6f25098c-2b21-48c9-80eb-f5f9d85f19f9` |
| Login do site, CSS e JavaScript | HTTP 200 |
| Rota protegida sem sessão | Redireciona ao login |

- [Workflow Web: qualidade e deploy aprovados](https://github.com/gunswiz/Metallo/actions/runs/34351449954)
- [Workflow Android: build, assinatura, publicação e ativação aprovados](https://github.com/gunswiz/Metallo/actions/runs/34351454124)

Validação local anterior: 49 testes Web, 39 Mobile e 8 de publicação; análise e builds aprovados. O GitHub executou novamente as verificações previstas antes da distribuição. O arquivo público foi baixado novamente e inspecionado com `apksigner` e `aapt`.

Nenhuma migration foi executada e nenhum dado operacional de produção foi alterado para testar a publicação. As novas operações de negócio continuam sujeitas às limitações de homologação documentadas em `11_FUNCOES_MOBILE_NO_WEB.md`.

O aviso de desenvolvedor desconhecido pelo Google Play Protect pode continuar aparecendo. A publicação não equivale à aprovação do Google; não foram alteradas proteções do Android ou a assinatura do Metallo.

## Recuperação

A versão Cloudflare anterior à publicação era `728b09b4-665a-4eff-b861-7de35758bbe1`. A release Android 0.9.7 continua disponível no GitHub. Uma correção Android deve receber build superior a 49; não anuncie um build antigo como atualização. Reverter o manifesto não desinstala nem rebaixa o APK já instalado.

A cópia local foi sincronizada com o commit que ativou `updates/latest.json`.
