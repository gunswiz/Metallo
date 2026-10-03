# Backlog formal da Gestão

**Estado da baseline imutável R1 em27/09/2026:** Web completa **93/97**, exatamente quatro falhas antigas da Gestão, explicitamente preservadas no fechamento doMarco1B em laboratório. Evidência R1: `auditoria-1b/web-final.json`; nomes e hashes conferidos na baseline1B. Histórico:63/67 e67/71 antes da ampliação dos testes do portal. Na R1, elas não foram corrigidas nem aceitas como aprovação da Gestão. Nenhuma data ou decisão empresarial foi presumida. O saneamento posterior está registrado ao fim deste documento; não modifica a fotografia R1.

| ID | Pendência confirmada | Evidência | Critério de resolução |
| --- | --- | --- | --- |
| G-WEB-01 | `obras-telas`: formulário de consumo não está no modo padrão atual; teste aborta antes de verificar permissões/alertas | `obras-pedidos.tsx`, `obras-telas.test.tsx`, JSON final; passa no HEAD e falha no checkout com alterações locais anteriores | Alinhar tela/contrato/montagem do teste mantendo todas as asserções de permissão; executar e disponibilizar prévia local |
| G-WEB-02 | `obras-telas`: rótulo da equipe ausente; teste não chega aos envios e não comprova idempotência | Mesmo arquivo, segundo caso; passa no HEAD | Exercitar a tela atual, duplo envio, resposta incerta e reenvio com mesmo ID, sem remover asserções |
| G-WEB-03 | Ação de locados chama `replace_rented_equipment`, ausente da baseline e do catálogo remoto salvo; teste espera `update_equipment_admin_v2` | `app/actions/substituir-locado.ts`; migration `20260912190000_unify_existing_operations.sql:82`; `auditoria-complementar/investigacao-rpc-gestao.json` | Decidir contrato da Gestão; validar SQL efetivo, preservação da locação/histórico, autorização, exclusão de owned e redirect com ID novo. Migration só em marco próprio e remoto só com autorização específica |
| G-WEB-04 | Legenda do gráfico usa 12px, proibidos pelo teste de acessibilidade | `globals.css:462`; falha também no HEAD eadd1f8 | Ajustar tipografia, executar teste e apresentar prévia visual antes de publicar |

Os três arquivos de testes afetados eram idênticos ao HEAD no controle anterior. As fontes da Gestão permaneceram inalteradas nesta rodada, inclusive nas reexecuções após T-05 (gate547) e T-15 (gate682); hashes conferidos novamente antes de gerar o pacote. A reexecução completa continuou mostrando as mesmas quatro falhas, sem skip, TODO, remoção ou enfraquecimento de testes.

## RPC de locados

A definição está em migration local não rastreada, criada pelo trabalho anterior da Gestão. A reconstrução fiel da baseline aplicou 33 SQLs históricos remotos e nove SQLs EPI especificados; essa migration de unificação não faz parte dessa lista. A função está ausente dos snapshots remoto/pré/pós-1A e o Postgres local atual retornou zero funções com esse nome. Portanto existe divergência real entre a ação Web do checkout e o SQL efetivo conhecido.

Não se aplicou a migration nem se restaurou silenciosamente a ação anterior. O banco local não utiliza a tabela de histórico gerenciada da CLI nessa reconstrução; a ausência da função foi medida no catálogo, sem alegar prova por um histórico que não existe. O estado remoto nesta análise é o snapshot somente leitura já salvo, sem nova consulta nesta rodada.

Este backlog não altera a decisão estrita do [Marco 1A em laboratório](30_CONFRONTO_AUDITORIA_FINAL_E_FECHAMENTO_1A.md), nem autoriza publicação de qualquer mudança da Gestão.

## Saneamento local posterior à R1 — candidato R2

As quatro falhas foram reproduzidas juntas antes da correção (**11/15** testes dirigidos; quatro falhas, `saneamento-r2/web-antes.json`). Após as correções, os mesmos testes deram **15/15** (`web-correcao.json`) e a suíte Web integral deu **97/97** (`web-final.json`, 34 arquivos, zero skips e zero falhas). O banco passou **31/31**, qualidade **44/44**, TypeScript e lint completos passaram. Auth real **18/18**, base **682/682**, rede **8/8**, coletor **12/12** e zoom real **200%** foram revalidados na rodada R2; o fechamento do pacote exige a varredura final e o manifesto próprios.

| ID | Causa e origem | Correção local | Prova após correção |
| --- | --- | --- | --- |
| G-WEB-01 | O teste antigo montava o modo padrão embora o formulário atual de consumo esteja no modo `movement`; a fonte da Gestão já havia mudado antes do fechamento R1. | Montar o modo atual e conferir as opções de operação disponíveis para colaborador, a ausência de entrada direta e a reserva de alertas/gestão de obras ao administrador. Fixture recebeu saldo sintético necessário ao consumo. | `obras-telas.test.tsx`; testes dirigidos e Web integral verdes. Nenhuma expectativa de permissão removida. |
| G-WEB-02 | Rótulos antigos impediam a chegada às asserções de idempotência; a tela atual usa “Equipe que consumiu”, “Material” e “Quantidade (un)”. | Exercitar os rótulos atuais e manter duplo envio, falha de resposta e reenvio com mesmo ID; acrescentar conferência do comando/payload `run_site_operation`. | Mesmo teste, com asserções de fila e ID preservadas; testes dirigidos e Web integral verdes. |
| G-WEB-03 | A ação do checkout havia passado a usar `replace_rented_equipment`, presente apenas na migration local não aplicada e ausente do catálogo efetivo conhecido. | Restaurar o contrato já existente `update_equipment_admin_v2`, com `admin:manage`, ID da locação preservado, campos de locação preservados, nota antigo→novo, rejeição de bem próprio e invalidação de Obras. Nenhuma SQL ou regra de autorização foi alterada. | Catálogo local salvo em `saneamento-r2/contrato-locados-local.json`; teste de ação confirma RPC única, nota, permissão, exclusão e redirecionamento para o mesmo ID. Banco31/31. |
| G-WEB-04 | A legenda tinha `font-size:12px`, abaixo do mínimo já cobrado pelo teste. Falhava também no HEAD. | Usar o token tipográfico existente `--font-small` (14px), sem reduzir texto. | Teste de tipografia inalterado passou; Web integral verde. No Edge em zoom real200%, a legenda mediu14px CSS, sem rolagem horizontal. |

O R1 continua com **93/97** como evidência histórica; **97/97** é o resultado do checkout saneado. A comparação não é uma reescrita do histórico. A prévia do Colaborador está em `http://127.0.0.1:3101/colaborador/inicio` e a prévia sintética da Gestão em `http://127.0.0.1:3102/previa/correcoes-metallo` e `/previa/consumo`; nenhuma publicação ou alteração do Supabase remoto decorre deste saneamento.
