"""Empacota e examina a auditoria passiva 3E; nunca cria baseline ou escreve no banco."""

import ast
from datetime import datetime, timezone
import hashlib
from io import BytesIO
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import zipfile

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
LAB = ROOT / "04_BANCO_E_SUPABASE/laboratorio-marco-3e"
ORIGIN_ID = "METALLO-3D-LAB-20260929-R1"
ORIGIN_SHA = "4246426837e90324b1e2242ca2162dd0d2b0d3cd49c72abb8c209283ec6b9516"
ORIGIN = ROOT / "outputs/Metallo-Marco3D-BaselineAprovada-20260929-R1.zip"
assert len(sys.argv) == 2 and sys.argv[1] in {"1", "2", "scan1", "scan2"}
ARG = sys.argv[1]
CYCLE = ARG[-1]
TARGET = ROOT / f"outputs/Metallo-Marco3E-FichaHistorico-Auditoria-20260929-Ciclo{CYCLE}.zip"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read(name):
    return (ROOT / name).read_bytes()


# Reutiliza somente as definições do scanner; não executa o construtor de baseline 3D.
scanner_source = ROOT / "04_BANCO_E_SUPABASE/laboratorio-marco-3d/gerar-baseline-3d.py"
tree = ast.parse(scanner_source.read_text(encoding="utf-8-sig"))
nodes = [node for node in tree.body if
         isinstance(node, ast.FunctionDef) and node.name == "local_secrets" or
         isinstance(node, ast.Assign) and any(isinstance(target, ast.Name) and target.id == "PATTERNS"
                                              for target in node.targets)]
assert len(nodes) == 2
scanner = {"ROOT": ROOT, "re": re, "json": json}
exec(compile(ast.Module(body=nodes, type_ignores=[]), str(scanner_source), "exec"), scanner)
assert sha(ORIGIN.read_bytes()) == ORIGIN_SHA
assert not (ROOT / "04_BANCO_E_SUPABASE/laboratorio-marco-1a/supabase/.temp/project-ref").exists()


if ARG.startswith("scan"):
    receipt_path = Path(str(TARGET) + ".verificacao.json")
    assert TARGET.is_file() and not receipt_path.exists(), "ZIP ausente ou recibo já existente"
    known = scanner["local_secrets"]()
    status = subprocess.run(["node", str(ROOT / "node_modules/supabase/dist/supabase.js"),
                             "status", "--workdir", str(ROOT / "04_BANCO_E_SUPABASE/laboratorio-marco-1a"),
                             "-o", "json"], capture_output=True, text=True, check=True)
    settings = json.loads(status.stdout)
    assert settings["API_URL"] == "http://127.0.0.1:54321"
    known.update(settings[key] for key in ("SERVICE_ROLE_KEY", "JWT_SECRET", "SECRET_KEY") if settings.get(key))
    local_scan = json.loads((LAB / "resultado-segredos-3e.json").read_text(encoding="utf-8-sig"))
    accepted = {(row["path"], row["kind"], match["match_sha256"]): match
                for row in local_scan["triage"] for match in row["matches"]
                if match["classification"] == "NOT_SECRET"}
    # Revisão explícita do novo trecho sintático do ensaio, sem liberar valores
    # arbitrários de cookie. Hash exato; todo trecho diferente continua bloqueado.
    expression_sha = "f19e74f58673729f19bff10429fba4ef0883f1d834b736db2233e21d06750885"
    accepted[("04_BANCO_E_SUPABASE/laboratorio-marco-3e/provas-3e.mjs", "cookie literal", expression_sha)] = {
        "match_sha256": expression_sha, "classification": "NOT_SECRET",
        "reason": "Exact reviewed source expression references restrictedCookie in memory; contains no cookie value"}
    findings, alerts, triage, pdfs = [], [], [], []
    with zipfile.ZipFile(TARGET) as archive:
        assert archive.testzip() is None
        names = archive.namelist()
        manifest = json.loads(archive.read("MANIFESTO_SHA256.json"))
        assert len(names) == len(set(names)) == manifest["zip_entries"]
        assert manifest["id"] == f"METALLO-3E-AUDITORIA-CICLO{CYCLE}"
        assert set(names) == {row["path"] for row in manifest["files"]} | {"MANIFESTO_SHA256.json"}
        for row in manifest["files"]:
            raw = archive.read(row["path"])
            assert len(raw) == row["bytes"] and sha(raw) == row["sha256"], row["path"]
        for item in archive.infolist():
            name = item.filename
            parts = PurePosixPath(name).parts
            if (item.is_dir() or not parts or name.startswith("/") or ".." in parts or ":" in name or "\\" in name
                or any(part.lower() in {"backups", "node_modules", ".git", ".temp", "cookies", "credentials", "credenciais"}
                       or part.lower().startswith((".env", ".next")) for part in parts)
                or re.search(r"\.(?:pem|pfx|p12|key|sqlite|db|dump|bak|pgdump|zip|map)$", name, re.I)):
                findings.append({"path": name, "kind": "arquivo/caminho indevido"})
            raw = archive.read(item)
            text = raw.decode("utf-8-sig", errors="ignore")
            if name.endswith(".pdf"):
                reader = PdfReader(BytesIO(raw))
                human = "\n".join(page.extract_text() or "" for page in reader.pages) + "\n" + str(reader.metadata)
                text += "\n" + human
                if re.search(r"\bCPF\b|\bASO\b|salário|internal_note|refresh_token", human, re.I):
                    findings.append({"path": name, "kind": "campo pessoal indevido no texto/metadados do PDF"})
                pdfs.append({"path": name, "pages": len(reader.pages), "sha256": sha(raw),
                             "raw_and_extracted_text_scanned": True})
            for kind, pattern in scanner["PATTERNS"]:
                matches = list(re.finditer(pattern, text, re.I))
                if not matches:
                    continue
                alerts.append({"path": name, "kind": kind, "occurrences": len(matches)})
                reviewed = []
                for match in matches:
                    digest = sha(match.group().encode())
                    decision = accepted.get((name, kind, digest))
                    if decision:
                        reviewed.append(decision)
                    else:
                        findings.append({"path": name, "kind": kind, "match_sha256": digest})
                triage.append({"path": name, "kind": kind, "matches": reviewed})
            if any(secret in text for secret in known):
                findings.append({"path": name, "kind": "credencial local conhecida"})
    receipt = {"at": datetime.now(timezone.utc).isoformat(), "scope": "scan direto de todas as entradas do ZIP final 3E",
               "zip": {"path": TARGET.relative_to(ROOT).as_posix(), "sha256": sha(TARGET.read_bytes()), "entries": len(names)},
               "known_local_credentials_checked": len(known), "manifest_and_entry_hashes_verified": True,
               "pdfs": pdfs, "initial_raw_alerts": alerts, "triage": triage, "values_redacted": True,
               "findings": findings, "passed": not findings, "is_approved_baseline": False}
    receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if findings:
        print(json.dumps({"passed": False, "findings": findings}, ensure_ascii=False))
        sys.exit(1)
    Path(str(TARGET) + ".sha256").write_text(f"{receipt['zip']['sha256']}  {TARGET.name}\n", encoding="ascii")
    print(json.dumps({"passed": True, "zip": str(TARGET), "sha256": receipt["zip"]["sha256"],
                      "entries": len(names), "confirmed_findings": 0, "triaged_groups": len(triage)}, ensure_ascii=False))
    sys.exit(0)


assert not TARGET.exists(), "Não sobrescrever pacote existente"
result = json.loads((LAB / "resultado-3e.json").read_text(encoding="utf-8-sig"))
assert len(result["checks"]) >= 41 and all(row["ok"] for row in result["checks"])
units = (LAB / "unitarios-final.log").read_text(encoding="utf-8-sig")
unit_count = int(re.search(r"Tests\s+(\d+) passed", units).group(1))
assert unit_count >= 14
for label in ("typecheck-final", "lint-ajustes-final"):
    assert "exit_code=0" in (LAB / f"{label}.log").read_text(encoding="utf-8-sig")
previous_scan = json.loads((LAB / "resultado-segredos-3e.json").read_text(encoding="utf-8-sig"))
assert previous_scan["passed"] and not previous_scan["findings"]
with zipfile.ZipFile(ORIGIN) as archive:
    origin_manifest_raw = archive.read("MANIFESTO_SHA256.json")
    origin_manifest = json.loads(origin_manifest_raw)
    assert origin_manifest["id"] == ORIGIN_ID
    origin_rows = {row["path"]: row for row in origin_manifest["files"]}
    origin_sources = {name: archive.read(name) for name in origin_rows}
    assert all(sha(raw) == origin_rows[name]["sha256"] for name, raw in origin_sources.items())

# Somente dependências necessárias à inspeção estática do contrato e da autorização 3E.
paths = {row["path"] for row in previous_scan["files_checked"] if "/.next" not in row["path"]}
paths.update({
    "AGENTS.md", "package.json", "01_WEB/package.json", "01_WEB/vitest.config.ts",
    "01_WEB/public/metallo-logo.png", "01_WEB/03_FUNCOES_E_LOGICA/unidadesConsumo.ts",
    "01_WEB/03_FUNCOES_E_LOGICA/Autenticacao/session.ts",
    "01_WEB/05_ACESSO_A_DADOS/Supabase/server.ts", "01_WEB/09_CONFIGURACOES/ambienteSupabase.ts",
    "01_WEB/09_CONFIGURACOES/colaborador-laboratorio.ts",
    "01_WEB/app/colaborador/[[...screen]]/epi-recebimento.tsx",
    "01_WEB/app/colaborador/[[...screen]]/epi-troca.tsx",
    "01_WEB/10_TESTES/colaborador-seguranca.test.ts",
    "04_BANCO_E_SUPABASE/laboratorio-marco-1a/criar-contas-previa-1b.mjs",
    "04_BANCO_E_SUPABASE/laboratorio-marco-1a/revogar-conta-portal-servidor.mjs",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3b/contrato-epis.sql",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3c/contrato-troca-epi.sql",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3c/catalogo-rpc-3c.json",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3c/resultado-3c.json",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3d/contrato-entrega-confirmacao.sql",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3d/resultado-3d.json",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3d/parecer-grok-ciclo2.md",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3d/gerar-baseline-3d.py",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3e/catalogo-rpc-3e.json",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3e/gerar-pacote-auditoria-3e.py",
    "05_DOCUMENTACAO/40_MARCO_3B_MEUS_EPIS.md",
    "05_DOCUMENTACAO/41_MARCO_3C_SOLICITAR_TROCA_EPI.md",
    "05_DOCUMENTACAO/42_MARCO_3D_ENTREGA_CONFIRMACAO_EPI.md",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260902231312_epi_management.sql",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260903050000_epi_grouped_deliveries.sql",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260903133000_epi_stock_variants.sql",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260907060320_close_partial_epi_delivery.sql",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260912073507_user_operation_permissions.sql",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260925120000_employee_identity_foundation.sql",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260926213000_portal_profile_optional_team.sql",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260926224000_unassigned_employee_management_scope.sql",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260926233500_personal_epi_explicit_team_scope.sql",
})
if CYCLE == "2":
    paths.update({"04_BANCO_E_SUPABASE/laboratorio-marco-3e/parecer-grok-ciclo1.md",
                  "04_BANCO_E_SUPABASE/laboratorio-marco-3e/resultado-segredos-3e.json",
                  "04_BANCO_E_SUPABASE/laboratorio-marco-3e/reproducao-ciclo1.json",
                  "04_BANCO_E_SUPABASE/laboratorio-marco-3e/provas-ciclo2.log",
                  "04_BANCO_E_SUPABASE/laboratorio-marco-3e/provas-ciclo2-diagnostico.log",
                  "04_BANCO_E_SUPABASE/laboratorio-marco-3e/provas-ciclo2-diagnostico-http.log",
                  "04_BANCO_E_SUPABASE/laboratorio-marco-3e/provas-ciclo2-final.log",
                  "04_BANCO_E_SUPABASE/laboratorio-marco-3e/web-tentativa-paralela.log",
                  "04_BANCO_E_SUPABASE/laboratorio-marco-3e/web-ciclo2-sequencial-1.log",
                  "04_BANCO_E_SUPABASE/laboratorio-marco-3e/web-ciclo2-sequencial-2.log",
                  "04_BANCO_E_SUPABASE/laboratorio-marco-3e/lint-ciclo2-tentativa.log",
                  "outputs/Metallo-Marco3E-FichaHistorico-Auditoria-20260929-Ciclo2-PreTriagem.zip.verificacao.json",
                  "outputs/Metallo-Marco3E-FichaHistorico-Auditoria-20260929-Ciclo2-PreTriagemScanner.zip.verificacao.json",
                  "outputs/Metallo-Marco3E-FichaHistorico-Auditoria-20260929-Ciclo1.zip.verificacao.json"})
payload = {name: read(name) for name in sorted(paths)}
payload["BASELINE_3D_MANIFESTO.json"] = origin_manifest_raw
for name, raw in list(payload.items()):
    if name in origin_sources and name.startswith(("01_WEB/", "04_BANCO_E_SUPABASE/")) and sha(raw) != sha(origin_sources[name]):
        payload[f"BASELINE_3D_RELEVANTE/{name}"] = origin_sources[name]

prompt = f"""# Auditoria adversarial independente — Marco 3E, ciclo {CYCLE}

Inspecione integralmente o ZIP anexado e o recibo externo do scan direto. Confira
hash do ZIP, manifesto e cada entrada. Origem imutável {ORIGIN_ID}, SHA-256
{ORIGIN_SHA}. O manifesto da origem e as versões relevantes permitem comparação;
o ZIP completo da origem não está anexado: não alegue recomputar seu hash aqui.
Os quatro PDFs revisados foram aprovados manualmente pelo responsável, incluindo
ciência/assinatura, referências, textos humanos e paginação. Não existe baseline 3E.
SIMULAÇÃO SEM VALOR OFICIAL. Supabase remoto intocado; somente laboratório sintético.

Permita apenas inspeção passiva no SEU ambiente: listar, abrir, extrair ZIP, pesquisar
texto, comparar arquivos e calcular hashes. PROIBIDO executar scripts do projeto,
SQL, migrations, testes, Auth, containers, endpoints, rede do laboratório, modificar
o projeto ou acessar Supabase remoto. Você é auditor, não desenvolvedor. Resultados
anexos são provas locais do emissor; não são reprodução independente pelo auditor.

Foco obrigatório: João acessando PDF/dados de Maria e Maria→João; employee_id
injetado em RPC/body/URL/querystring; report_id enumerável/IDOR; filtro manipulável;
rota PDF Gestão sem autorização/equipe; funcionário sem equipe com acesso pessoal;
inativo/revogado/JWT residual; relatório alterando entrega, confirmação ou estoque;
SECURITY DEFINER (owner, search_path, overloads), helper privado, RLS e grants,
catálogo aplicado versus SQL; vazamento de notas internas, CPF, ASO, salário e outros
dados dispensáveis; segredo em código/log/PDF/pacote; cache após logout/troca de conta,
geração pendente, Blob URL residual; HTML/texto/filename injection; DoS por período
enorme ou texto extenso; limites da extração e do documento; data inválida, fuso,
ordem e período inclusivo; origem fora do período sem inventar evento no intervalo.

Examine Ficha Atual versus Histórico, entrega≠confirmação, aprovação 3C≠entrega,
CA histórico≠CA atual/validade do produto, legado dependente do catálogo claramente
identificado, snapshots, agrupamento, vínculos de troca e encerramentos. Tente
encontrar relatório que sugira atendimento de Capacete por Luva incompatível.
Há prova real exchange_item_mismatch sem efeitos; a fixture antiga foi corrigida
e a projeção sinaliza inconsistência por item_id. Não invente regra de substituição.
Confira responsável nominal somente com snapshot confiável; fonte atual nominal
ausente deve exibir aviso sem UUID como nome. IDs técnicos ficam no DTO; referências
Entrega/Grupo são locais ao relatório e report_id não é índice persistente.

Nos quatro PDFs confira A4, logo, margens, Página X de Y, eventos normais inteiros,
assinatura da ficha preservada, ciência do histórico uma única vez na última página
após todos os eventos, aviso de NÃO confirmação retroativa, singular/plural e enums
humanizados. Não confundir renderizações 100/200% com prova de zoom real do navegador.
PDF é projeção regenerável, não arquivo imutável/assinado. Avalie integridade/hash
somente no que existe: hashes do pacote/evidências não são assinatura digital do PDF.

Confira fontes legais oficiais mapeadas e separação de conceitos: confirmação do
portal NÃO classificada como assinatura avançada, qualificada ou ICP-Brasil;
assinatura manuscrita é campo da via impressa, não exigência específica NR-6 nem
confirmação retroativa; não inventar identidade empresarial ou histórico. Revisão
jurídica/SST, retenção, guarda e uso real permanecem gates futuros, sem certificação.
Não ampliar o escopo para modificar 3D ou núcleo de ponto 2F.

Produza TODOS os achados numerados F-3E-XX. Para cada: ID, severidade, estado
CONFIRMADO/PARCIAL/HIPÓTESE/LACUNA DE EVIDÊNCIA/RISCO FUTURO, arquivo/linha, condição,
caminho de exploração/falha, evidência, impacto, correção mínima e teste de aceitação.
Não trate hipótese como vulnerabilidade comprovada. Distinga risco administrativo
do host, uso em produção e evidência local. Diga se há CRÍTICO ou ALTO confirmado
e aberto neste escopo e quais médios/baixos/lacunas permanecem. Não aprovar baseline,
produção ou publicação. Máximo dois ciclos; após confronto, o emissor para.
"""
if CYCLE == "2":
    prompt += "\nSEGUNDO E ÚLTIMO CICLO: confronte cada achado do ciclo 1 anexado com correções/provas e o confronto no documento vigente. Declare o estado final de todos. Não solicitar terceiro ciclo.\n"
    prompt += "Os quatro PDFs aprovados permanecem idênticos aos do ciclo 1: sem mudança no renderizador nem nova emissão das amostras. Examine a retenção da entrega EPI 3D após reclassificação atual do catálogo, mantendo uniforme sem grupo excluído. O legado sem grupo não tem snapshot de classificação e sua limitação continua documentada. Não desligamos constraints para fabricar entrega órfã. Confira a FK e UNIQUE agora no catálogo aplicado. A página Next notFound pode usar status 200 com boundary 404 após iniciar streaming; compare a prova observada e ausência de relatório com o 404 literal neutro da rota PDF. O escopo global do engenheiro NULL vem de regra explícita herdada, não foi alterado; os testes distinguem escopo explícito A/B. Os limites SQL/renderer têm provas e mensagens distintas, sem prometer que reduzir período supera o limite SQL. Não extrapole desempenho, produção, impressão ou zoom a partir dessas provas.\n"
payload["PROMPT_REVISAO_SOMENTE_LEITURA.md"] = prompt.encode("utf-8")
payload["LEIA-ME.md"] = (f"# Marco 3E — auditoria passiva ciclo {CYCLE}\n\n"
    "SIMULAÇÃO SEM VALOR OFICIAL. PDF e interface aprovados manualmente; sem baseline 3E. "
    "Seleção de código, SQL, catálogo aplicado sem dados de pessoas, resultados locais, documentação, "
    "quatro amostras sintéticas e comparação com a origem 3D. Não é checkout executável nem backup. "
    "Nenhum .env, dump, bundle, JWT, cookie, senha ou chave deve integrar o pacote. "
    "O recibo externo refere o SHA-256 do ZIP final, evitando autorreferência; enviar os dois juntos. "
    "Resultados completos anteriores estão identificados como anteriores; ajustes finais repetiram "
    "somente testes afetados. Sem somar suítes sobrepostas. Sem remoto, produção, funcionários reais, "
    "publicação, ponto oficial, REP-P ou novo módulo.\n").encode("utf-8")
files = [{"path": name, "bytes": len(raw), "sha256": sha(raw)} for name, raw in sorted(payload.items())]
manifest = {"id": f"METALLO-3E-AUDITORIA-CICLO{CYCLE}", "is_approved_baseline": False,
    "at": datetime.now(timezone.utc).isoformat(), "mandatory_label": "SIMULAÇÃO SEM VALOR OFICIAL",
    "origin": {"id": ORIGIN_ID, "sha256": ORIGIN_SHA, "manifest_sha256": sha(origin_manifest_raw),
               "all_origin_entry_hashes_verified_locally": True, "full_origin_zip_included": False},
    "manual_approval": "responsável aprovou Ficha Atual, Histórico Completo, Filtrado e Multipágina revisados",
    "results": {"3E_real": f"{len(result['checks'])}/{len(result['checks'])}", "affected_units": f"{unit_count}/{unit_count}",
                "3D_prior": "77/77", "3C_prior": "70/70", "3B_prior": "48/48", "3A_prior": "49/49",
                "Web_prior": "159/159", "database_prior": "31/31", "quality_prior": "44/44", "network_prior": "8/8",
                "TypeScript_current": "pass", "lint_affected_current": "pass", "lint_full_and_build_prior": "pass"},
    "overlapping_suites_do_not_sum": True, "files": files, "inventory_count": len(files), "zip_entries": len(files) + 1,
    "delta_from_3d": [{"path": name, "kind": "changed" if name in origin_rows else "new",
                       "origin_sha256": origin_rows.get(name, {}).get("sha256"), "current_sha256": sha(raw)}
                      for name, raw in sorted(payload.items()) if not name.startswith("BASELINE_3D_")
                      and origin_rows.get(name, {}).get("sha256") != sha(raw)],
    "secret_scan_receipt": TARGET.relative_to(ROOT).as_posix() + ".verificacao.json"}
if CYCLE == "2":
    web_counts = []
    for index in (1, 2):
        log = (LAB / f"web-ciclo2-sequencial-{index}.log").read_text(encoding="utf-8-sig")
        assert "exit_code=0" in log and " failed" not in log
        web_counts.append(int(re.search(r"Tests\s+(\d+) passed", log).group(1)))
    assert web_counts[0] == web_counts[1] and web_counts[0] >= 159
    manifest["results"]["Web_current_two_sequential_runs"] = [f"{count}/{count}" for count in web_counts]
    manifest["cycle1_opinion_sha256"] = sha((LAB / "parecer-grok-ciclo1.md").read_bytes())
payload["MANIFESTO_SHA256.json"] = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
with zipfile.ZipFile(TARGET, "x", zipfile.ZIP_DEFLATED) as archive:
    for name, raw in sorted(payload.items()):
        archive.writestr(name, raw)
print(json.dumps({"zip": str(TARGET), "sha256": sha(TARGET.read_bytes()), "entries": len(payload),
                  "delta": len(manifest["delta_from_3d"]), "baseline_created": False}, ensure_ascii=False))
