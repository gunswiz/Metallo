"""Empacota somente evidências sanitizadas do Marco 3C para inspeção passiva."""

from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
import hashlib
import io
import json
import re
import sys
import zipfile


root = Path(__file__).resolve().parents[2]
assert len(sys.argv) == 2 and sys.argv[1] in {"1", "2", "baseline", "scan-baseline"}, "Uso: gerar-pacote-auditoria-3c.py 1|2|baseline|scan-baseline"
cycle = sys.argv[1]
origin_id = "METALLO-3B-LAB-20260928-R1"
origin_hash = "b8f6e5955b3cc9f4a670212fd24451c30d0fac9e7dba4acd544186f180356148"
origin = root / "outputs/Metallo-Marco3B-BaselineAprovada-20260928-R1.zip"
target = root / ("outputs/Metallo-Marco3C-BaselineAprovada-20260928-R1.zip" if cycle in {"baseline", "scan-baseline"}
                 else f"outputs/Metallo-Marco3C-TrocaEPI-Auditoria-20260928-Ciclo{cycle}.zip")
assert cycle == "scan-baseline" or not target.exists(), "Não sobrescrever pacote existente"
assert not (root / "04_BANCO_E_SUPABASE/laboratorio-marco-1a/supabase/.temp/project-ref").exists(), "CLI ligada a projeto remoto"


def digest(content):
    return hashlib.sha256(content).hexdigest()


assert digest(origin.read_bytes()) == origin_hash, "Baseline 3B alterada"
with zipfile.ZipFile(origin) as archive:
    old_manifest = json.loads(archive.read("MANIFESTO_SHA256.json"))
    assert old_manifest["id"] == origin_id
    old_files = {row["path"]: row["sha256"] for row in old_manifest["files"]}

if cycle == "baseline":
    audit_hashes = {
        1: "f1b2083d96c07e2e081fd271c8b6af54c829375e5ba91471c63057651b55bded",
        2: "8f39505a03fab270dbae3faffcf98f157e7d5205b74e53126b5209c3d0d1df87",
    }
    audits = {n: root / f"outputs/Metallo-Marco3C-TrocaEPI-Auditoria-20260928-Ciclo{n}.zip" for n in audit_hashes}
    for n, path in audits.items():
        assert digest(path.read_bytes()) == audit_hashes[n], f"Pacote auditado ciclo {n} mudou"
        receipt = json.loads(Path(str(path) + ".verificacao.json").read_text(encoding="utf-8-sig"))
        assert receipt["passed"] and receipt["findings"] == []
        assert receipt["zip"]["sha256"] == audit_hashes[n]
        assert receipt["zip"]["entries"] == (54 if n == 1 else 65)
    lab = root / "04_BANCO_E_SUPABASE/laboratorio-marco-3c"
    opinions = {n: lab / f"parecer-grok-ciclo{n}.md" for n in audit_hashes}
    opinion_hashes = {
        1: "6144de7f15d6db54e79236989d0f551cdee1207ded596de3f242a2867248264e",
        2: "42e6f62d675077eb79afd160c5f1826eb27b5447ad703a9a451aee0960612fba",
    }
    for n, path in opinions.items():
        assert digest(path.read_bytes()) == opinion_hashes[n], f"Parecer ciclo {n} mudou"
    report = json.loads((lab / "resultado-3c.json").read_text(encoding="utf-8-sig"))
    assert report["passed"] and report["count"] == 70 and len(report["checks"]) == 70
    assert all(row["ok"] for row in report["checks"])
    assert "142 passed (142)" in (lab / "web-ciclo2.log").read_text(encoding="utf-8-sig")
    for name, count in (("banco", 31), ("qualidade", 44)):
        log = (lab / f"{name}-ciclo2.log").read_text(encoding="utf-8-sig")
        assert re.search(rf"\bpass {count}\b", log) and re.search(r"\bfail 0\b", log), name
    network = json.loads((lab / "rede.json").read_text(encoding="utf-8-sig"))
    assert network["passed"] and len(network["checks"]) == 8 and all(row["ok"] for row in network["checks"])
    for name in ("typecheck", "lint", "build"):
        log = (lab / f"{name}-ciclo2.log").read_text(encoding="utf-8-sig")
        assert "$ " in log and "Error:" not in log and "[ELIFECYCLE]" not in log, name
    doc = root / "05_DOCUMENTACAO/41_MARCO_3C_SOLICITAR_TROCA_EPI.md"
    doc_text = doc.read_text(encoding="utf-8")
    assert "MARCO 3C — SOLICITAR TROCA DE EPI FUNCIONAL EM LABORATÓRIO" in doc_text
    assert "METALLO-3C-LAB-20260928-R1" in doc_text and "SOLICITAÇÃO ≠ APROVAÇÃO ≠ ENTREGA ≠ CONFIRMAÇÃO" in doc_text
    payload, provenance = {}, {}
    with zipfile.ZipFile(origin) as previous:
        for row in old_manifest["files"]:
            name = row["path"]
            if name in {"LEIA-ME.md", "PROMPT_REVISAO_SOMENTE_LEITURA.md"}:
                continue
            data = previous.read(name)
            assert digest(data) == row["sha256"], name
            payload[name], provenance[name] = data, "baseline_3b"
    with zipfile.ZipFile(audits[2]) as audited:
        audit_manifest = json.loads(audited.read("MANIFESTO_SHA256.json"))
        assert audit_manifest["id"] == "METALLO-3C-AUDITORIA-CICLO2"
        for row in audit_manifest["files"]:
            name = row["path"]
            if name in {"LEIA-ME.md", "PROMPT_REVISAO_SOMENTE_LEITURA.md", "BASELINE_3B_ORIGEM.zip"} or name.startswith("BASELINE_3B_RELEVANTE/"):
                continue
            data = audited.read(name)
            assert digest(data) == row["sha256"], name
            if name.startswith(("01_WEB/", "04_BANCO_E_SUPABASE/")) and name.lower().endswith((".ts", ".tsx", ".mjs", ".sql")):
                assert digest((root / name).read_bytes()) == digest(data), f"Código pós-auditoria divergente: {name}"
            payload[name], provenance[name] = data, "auditoria_3c_ciclo2"
    final_paths = [
        "05_DOCUMENTACAO/41_MARCO_3C_SOLICITAR_TROCA_EPI.md",
        "04_BANCO_E_SUPABASE/laboratorio-marco-3c/parecer-grok-ciclo2.md",
        "04_BANCO_E_SUPABASE/laboratorio-marco-3c/gerar-pacote-auditoria-3c.py",
        "04_BANCO_E_SUPABASE/laboratorio-marco-1a/verificar-rede-local.mjs",
        "outputs/Metallo-Marco3C-TrocaEPI-Auditoria-20260928-Ciclo2.zip.verificacao.json",
    ]
    for name in final_paths:
        payload[name], provenance[name] = (root / name).read_bytes(), "fechamento_3c"
    payload["BASELINE_3B_MANIFESTO.json"] = (json.dumps(old_manifest, ensure_ascii=False, indent=2) + "\n").encode()
    provenance["BASELINE_3B_MANIFESTO.json"] = "origem_3b"
    payload["LEIA-ME.md"] = ("# Marco 3C — baseline aprovada em laboratório\n\n"
        "SIMULAÇÃO SEM VALOR OFICIAL. Origem METALLO-3B-LAB-20260928-R1. "
        "Aprovação visual 100% e 200%; dois ciclos Grok somente leitura confrontados. "
        "Resultados: 3C 70/70, Web 142/142, banco 31/31, qualidade 44/44, rede 8/8, "
        "TypeScript/lint/build aprovados. Suítes sobrepostas não se somam. "
        "SOLICITAÇÃO ≠ APROVAÇÃO ≠ ENTREGA ≠ CONFIRMAÇÃO. "
        "O manifesto contém inventário, hashes e delta desde 3B; o recibo do scan final fica fora do ZIP. "
        "Supabase remoto intocado. Sem produção, funcionários reais, publicação, ponto oficial ou REP-P. "
        "Marco 3D apenas direção conceitual; núcleo de ponto 2F congelado.\n").encode()
    provenance["LEIA-ME.md"] = "fechamento_3c"
    for name in payload:
        parts = PurePosixPath(name).parts
        assert parts and not any(part in {"..", ".git", ".temp", "backups", "node_modules"} or part.startswith(".env") for part in parts), name
        assert not name.lower().endswith((".pem", ".key", ".pfx", ".p12", ".sqlite", ".db")), name
    files = [{"path": name, "bytes": len(data), "sha256": digest(data), "source": provenance[name]}
             for name, data in sorted(payload.items())]
    delta = [{"path": name, "kind": "novo" if name not in old_files else "alterado",
              "old_sha256": old_files.get(name), "current_sha256": digest(data)}
             for name, data in sorted(payload.items()) if old_files.get(name) != digest(data)]
    manifest = {
        "id": "METALLO-3C-LAB-20260928-R1", "is_approved_baseline": True,
        "at": datetime.now(timezone.utc).isoformat(),
        "origin": {"id": origin_id, "sha256": origin_hash},
        "formal_approval": "responsável aprovou Colaborador e Gestão em 100% e 200% e autorizou fechamento/baseline 3C em 28/09/2026",
        "status": "MARCO 3C — SOLICITAR TROCA DE EPI FUNCIONAL EM LABORATÓRIO",
        "mandatory_label": "SIMULAÇÃO SEM VALOR OFICIAL",
        "audit_cycle_1": {"conversation": "https://grok.com/c/1149f59d-d72a-4503-b27c-d96e065fccba", "zip_sha256": audit_hashes[1], "opinion_sha256": opinion_hashes[1]},
        "audit_cycle_2": {"conversation": "https://grok.com/c/40eb88af-21c3-4988-a3b3-3052477c9297", "zip_sha256": audit_hashes[2], "opinion_sha256": opinion_hashes[2]},
        "grok_cycles": 2, "third_cycle_not_performed": True,
        "results": {"3C_Auth_JWT_PostgREST": "70/70", "Web": "142/142", "banco": "31/31", "qualidade": "44/44", "rede": "8/8", "TypeScript": "aprovado", "lint": "aprovado", "build": "aprovado"},
        "overlapping_suites_do_not_sum": True, "critical_or_high_confirmed_open": False,
        "request_is_not_delivery": True,
        "residual_risks": ["log original da corrida Web 140/141 sob carga ausente", "F-3B-05", "F-3B-15", "can_operate(permission, NULL) exige guarda nos futuros consumidores", "janela Auth → commit", "pedido aprovado permanece aberto até entrega", "administrador do host/banco controla histórico", "escopo futuro da Gestão por equipe", "segundo computador físico não ensaiado"],
        "limits": "Supabase remoto intocado; não implantado remotamente; sem produção, funcionários reais, publicação, ponto oficial ou REP-P; 2F congelado; 3D não iniciado",
        "next_direction_only": "3D Entrega e Confirmação de EPI: kit sugerido → revisão Gestão → entrega física → registro Gestão → confirmação ou divergência → Meus EPIs → troca futura 3C",
        "files": files, "inventory_count": len(files), "delta_from_3b": delta,
        "zip_entries": len(files) + 1,
        "secret_scan_receipt": target.relative_to(root).as_posix() + ".verificacao.json",
    }
    payload["MANIFESTO_SHA256.json"] = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode()
    with zipfile.ZipFile(target, "x", zipfile.ZIP_DEFLATED) as archive:
        for name, data in sorted(payload.items()):
            archive.writestr(name, data)
    with zipfile.ZipFile(target) as archive:
        assert len(archive.namelist()) == manifest["zip_entries"]
        assert all(digest(archive.read(row["path"])) == row["sha256"] for row in files)
    print(json.dumps({"zip": str(target), "sha256": digest(target.read_bytes()), "files": len(files), "entries": manifest["zip_entries"], "delta": len(delta)}, ensure_ascii=False))
    sys.exit(0)

if cycle == "scan-baseline":
    assert target.is_file(), "Baseline 3C ausente"
    known_values = set()
    def collect_sensitive(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if isinstance(child, str) and re.search(r"password|senha|token|secret|key", key, re.I) and len(child) >= 8:
                    known_values.add(child)
                else:
                    collect_sensitive(child)
        elif isinstance(value, list):
            for child in value:
                collect_sensitive(child)
    for credentials in (root / "backups").glob("credenciais-previa*.json"):
        try:
            collect_sensitive(json.loads(credentials.read_text(encoding="utf-8-sig")))
        except (UnicodeError, json.JSONDecodeError):
            pass
    findings = []
    checked = 0
    nested = 0
    forbidden_parts = {"backups", "node_modules", ".git", ".temp", "cookies", "credentials", "credenciais"}
    def inspect_archive(content, parent=""):
        global checked, nested
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            names = archive.namelist()
            assert len(names) == len(set(names)), "ZIP com entrada duplicada"
            for item in archive.infolist():
                if item.is_dir():
                    continue
                name = item.filename
                full_name = f"{parent}!{name}" if parent else name
                parts = PurePosixPath(name).parts
                checked += 1
                if not parts or name.startswith("/") or ".." in parts or any(p.lower() in forbidden_parts or p.lower().startswith(".env") for p in parts):
                    findings.append({"path": full_name, "kind": "caminho/arquivo indevido"})
                if re.search(r"\.(?:pem|pfx|p12|key|sqlite|db|dump|bak|pgdump)$", name, re.I):
                    findings.append({"path": full_name, "kind": "chave ou dump"})
                data = archive.read(item)
                if name.lower().endswith(".zip"):
                    nested += 1
                    try:
                        inspect_archive(data, full_name)
                    except zipfile.BadZipFile:
                        findings.append({"path": full_name, "kind": "ZIP aninhado inválido"})
                    continue
                content_text = data.decode("utf-8", errors="ignore")
                checks = (
                    ("JWT literal", r"eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{12,}"),
                    ("sb_secret literal", r"sb_secret_[A-Za-z0-9_-]{16,}"),
                    ("chave privada PEM", r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
                    ("cookie de sessão literal", r"(?:Set-Cookie:|Cookie:)\s+[^\r\n]{20,}"),
                    ("refresh token literal", r"(?:refresh_token|refreshToken)\s*[=:]\s*[\"'][A-Za-z0-9._-]{24,}[\"']"),
                    ("service_role literal", r"(?:SERVICE_ROLE_KEY|service_role_key)\s*[=:]\s*[\"'][A-Za-z0-9._-]{24,}[\"']"),
                    ("senha literal", r"(?:password|senha)\s*[=:]\s*[\"'][^\"'\r\n]{12,}[\"']"),
                )
                for kind, pattern in checks:
                    if re.search(pattern, content_text, re.I):
                        findings.append({"path": full_name, "kind": kind})
                if any(secret in content_text for secret in known_values):
                    findings.append({"path": full_name, "kind": "credencial sintética local conhecida"})
            return len(names)
    archive_data = target.read_bytes()
    entry_count = inspect_archive(archive_data)
    with zipfile.ZipFile(target) as archive:
        manifest = json.loads(archive.read("MANIFESTO_SHA256.json"))
        assert manifest["id"] == "METALLO-3C-LAB-20260928-R1"
        assert manifest["zip_entries"] == entry_count
        assert all(digest(archive.read(row["path"])) == row["sha256"] for row in manifest["files"])
    receipt = {"at": datetime.now(timezone.utc).isoformat(),
               "scope": "secret scan direto do ZIP final 3C, incluindo conteúdo ZIP aninhado",
               "zip": {"path": target.relative_to(root).as_posix(), "sha256": digest(archive_data), "entries": entry_count},
               "files_checked_recursive": checked, "nested_zips_checked": nested,
               "known_local_synthetic_credentials_checked": len(known_values),
               "findings": findings, "passed": not findings,
               "scanner": "laboratorio-marco-3c/gerar-pacote-auditoria-3c.py scan-baseline"}
    receipt_path = Path(str(target) + ".verificacao.json")
    assert not receipt_path.exists(), "Recibo existente; não sobrescrever"
    receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if findings:
        print(json.dumps({"passed": False, "findings": findings}, ensure_ascii=False))
        sys.exit(1)
    sha_path = Path(str(target) + ".sha256")
    assert not sha_path.exists(), "SHA externo existente; não sobrescrever"
    sha_path.write_text(f"{digest(archive_data)}  {target.name}\n", encoding="ascii")
    print(json.dumps({"passed": True, "zip": str(target), "sha256": digest(archive_data),
                      "entries": entry_count, "files_checked_recursive": checked, "nested_zips_checked": nested,
                      "findings": 0}, ensure_ascii=False))
    sys.exit(0)

report = json.loads((root / "04_BANCO_E_SUPABASE/laboratorio-marco-3c/resultado-3c.json").read_text(encoding="utf-8-sig"))
expected_checks = 67 if cycle == "1" else 70
assert report["passed"] and report["count"] == expected_checks and len(report["checks"]) == expected_checks
assert all(row["ok"] for row in report["checks"])
web = (root / "04_BANCO_E_SUPABASE/laboratorio-marco-3c/web.log").read_text(encoding="utf-8-sig")
assert "141 passed (141)" in web and "24 passed (24)" in web
if cycle == "2":
    assert "142 passed (142)" in (root / "04_BANCO_E_SUPABASE/laboratorio-marco-3c/web-ciclo2.log").read_text(encoding="utf-8-sig")
    network = json.loads((root / "04_BANCO_E_SUPABASE/laboratorio-marco-3c/rede.json").read_text(encoding="utf-8-sig"))
    assert network["passed"] and len(network["checks"]) == 8 and all(row["ok"] for row in network["checks"])
for name, count in (("banco", 31), ("qualidade", 44)):
    log = (root / f"04_BANCO_E_SUPABASE/laboratorio-marco-3c/{name}.log").read_text(encoding="utf-8-sig")
    assert re.search(rf"\bpass {count}\b", log) and re.search(r"\bfail 0\b", log), name
for name in ("typecheck", "lint", "build"):
    log = (root / f"04_BANCO_E_SUPABASE/laboratorio-marco-3c/{name}.log").read_text(encoding="utf-8-sig")
    assert "$ " in log and "Error:" not in log and "[ELIFECYCLE]" not in log, name
catalog = json.loads((root / "04_BANCO_E_SUPABASE/laboratorio-marco-3c/catalogo-rpc-3c.json").read_text(encoding="utf-8-sig"))
assert len(catalog["rpc"]) == 6 and len(catalog["tables"]) == 2 and catalog["event_guard"] == 1
assert all(row["security_definer"] and row["owner"] == "postgres" and row["authenticated_execute"]
           and not row["anon_execute"] and not row["service_role_execute"] for row in catalog["rpc"])
assert all(row["rls"] and not row["authenticated_select"] and not row["service_role_update"]
           for row in catalog["tables"])

paths = [
    "AGENTS.md",
    "05_DOCUMENTACAO/40_MARCO_3B_MEUS_EPIS.md",
    "05_DOCUMENTACAO/41_MARCO_3C_SOLICITAR_TROCA_EPI.md",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3b/contrato-epis.sql",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3b/resultado-3b.json",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3c/contrato-troca-epi.sql",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3c/provas-3c.mjs",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3c/resultado-3c.json",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3c/catalogo-rpc-3c.json",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3c/gerar-pacote-auditoria-3c.py",
    *[f"04_BANCO_E_SUPABASE/laboratorio-marco-3c/{name}.log"
      for name in ("web", "banco", "qualidade", "typecheck", "lint", "build")],
    "04_BANCO_E_SUPABASE/laboratorio-marco-1a/criar-contas-previa-1b.mjs",
    "04_BANCO_E_SUPABASE/laboratorio-marco-1a/revogar-conta-portal-servidor.mjs",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260925120000_employee_identity_foundation.sql",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260926213000_portal_profile_optional_team.sql",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260926224000_unassigned_employee_management_scope.sql",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260926233500_personal_epi_explicit_team_scope.sql",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260902231312_epi_management.sql",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260903050000_epi_grouped_deliveries.sql",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260907060320_close_partial_epi_delivery.sql",
    "01_WEB/03_FUNCOES_E_LOGICA/Autenticacao/use-colaborador-session.ts",
    "01_WEB/03_FUNCOES_E_LOGICA/Autenticacao/session.ts",
    "01_WEB/03_FUNCOES_E_LOGICA/executarOperacaoValidada.ts",
    "01_WEB/05_ACESSO_A_DADOS/Supabase/colaborador-local.ts",
    "01_WEB/05_ACESSO_A_DADOS/Supabase/server.ts",
    "01_WEB/05_ACESSO_A_DADOS/Repositorios/epi-operacoes-repository.ts",
    "01_WEB/09_CONFIGURACOES/colaborador-laboratorio.ts",
    "01_WEB/09_CONFIGURACOES/ambienteSupabase.ts",
    "01_WEB/app/actions/epi-completo.ts",
    "01_WEB/app/(02_SISTEMA)/epis/solicitacoes/page.tsx",
    "01_WEB/app/colaborador/[[...screen]]/epi-troca.tsx",
    "01_WEB/app/colaborador/[[...screen]]/meus-epis.tsx",
    "01_WEB/app/colaborador/[[...screen]]/colaborador-app.tsx",
    "01_WEB/app/colaborador/[[...screen]]/colaborador.module.css",
    "01_WEB/app/colaborador/[[...screen]]/use-personal-detail.ts",
    "01_WEB/10_TESTES/colaborador-troca-epi.test.tsx",
    "01_WEB/10_TESTES/colaborador-epis.test.tsx",
    "01_WEB/10_TESTES/colaborador-seguranca.test.ts",
]
if cycle == "2":
    paths.extend([
        "04_BANCO_E_SUPABASE/laboratorio-marco-3c/parecer-grok-ciclo1.md",
        "outputs/Metallo-Marco3C-TrocaEPI-Auditoria-20260928-Ciclo1.zip.verificacao.json",
        "04_BANCO_E_SUPABASE/supabase/migrations/20260912073507_user_operation_permissions.sql",
        "04_BANCO_E_SUPABASE/laboratorio-marco-3c/rede.json",
        *[f"04_BANCO_E_SUPABASE/laboratorio-marco-3c/{name}-ciclo2.log"
          for name in ("web", "banco", "qualidade", "typecheck", "lint", "build")],
    ])

payload = {}
for name in paths:
    parts = PurePosixPath(name).parts
    assert parts and not any(part in {"..", ".git", ".temp", "backups", "node_modules"}
                             or part.startswith(".env") for part in parts), name
    assert not name.lower().endswith((".pem", ".key", ".pfx", ".p12", ".sqlite", ".db")), name
    payload[name] = (root / name).read_bytes()
payload["BASELINE_3B_MANIFESTO.json"] = (json.dumps(old_manifest, ensure_ascii=False, indent=2) + "\n").encode()
if cycle == "2":
    payload["BASELINE_3B_ORIGEM.zip"] = origin.read_bytes()
with zipfile.ZipFile(origin) as archive:
    for name in paths:
        if name in old_files and name.startswith(("01_WEB/", "04_BANCO_E_SUPABASE/")):
            before = archive.read(name)
            assert digest(before) == old_files[name], name
            if digest(payload[name]) != digest(before):
                payload[f"BASELINE_3B_RELEVANTE/{name}"] = before

prompt = f"""# Auditoria independente adversarial — Marco 3C, ciclo {cycle}

Inspecione o ZIP anexado, manifesto, delta, SQL, código e provas. Origem imutável
{origin_id}, SHA-256 {origin_hash}, conferida localmente. O ZIP da origem não foi
anexado; o manifesto e as versões anteriores relevantes acompanham este pacote.
**SIMULAÇÃO SEM VALOR OFICIAL.** Aprovação visual manual de Colaborador e Gestão
em 100% e 200% foi registrada em 28/09/2026. Não há baseline 3C.

Você só pode usar comandos PASSIVOS no seu ambiente para listar, abrir, extrair,
pesquisar, comparar arquivos/ZIPs e calcular hashes. Proibido executar scripts
do projeto, SQL, migrations, testes, Auth, containers, chamadas ao laboratório,
acesso ao Supabase remoto ou qualquer alteração. Não alegue ter reproduzido
resultados cuja execução só consta nas evidências locais.

Audite especialmente: titularidade auth.uid() sem employee_id decisório; João e
Maria em criação, leitura, cancelamento e Gestão; delivery_id/request_id/body/
URL/query manipulados; conta/identidade/funcionário ativos; sem equipe/obra;
entrega encerrada entre tela, envio e aprovação; dupla submissão, cinco chamadas
concorrentes, duas abas, chave de idempotência e retry; transições, cancelamento,
histórico append-only, notas internas e motivo público; admin e permissão
epi:write por equipe; SECURITY DEFINER, owner, search_path, overloads, grants
de tabela/RPC e RLS reais do catálogo sanitizado; revogação/token residual;
offline sem falso sucesso ou fallback remoto; nenhuma mutação automática de
estoque, entrega, cobrança ou conclusão; conteúdo sensível e segredos em fonte,
logs, bundles ou ZIP. Distinga histórico de entrega 3B de histórico de pedido 3C.
Considere F-3B-05/F-3B-15 riscos herdados e a falha intermitente Web 140/141 sob
carga, seguida de 9/9 isolado e 141/141 serial, sem ocultá-la.

Produza achados numerados. Para cada: ID, severidade, status CONFIRMADO/PARCIAL/
HIPÓTESE/LACUNA DE EVIDÊNCIA/RISCO FUTURO, arquivo/linha, condição, caminho de
falha, evidência, impacto, correção mínima e teste de aceitação. Separe evidência
de código de reprodução independente. Indique qualquer CRÍTICO ou ALTO confirmado
e aberto no escopo local. Não crie baseline, não publique e não execute o projeto.
"""
if cycle == "2":
    prompt += "\nEste é o segundo e último ciclo. Confronte cada achado do parecer do ciclo 1 incluído; declare os estados finais, críticos/altos abertos e limites da inspeção passiva.\n"
payload["PROMPT_REVISAO_SOMENTE_LEITURA.md"] = prompt.encode()
payload["LEIA-ME.md"] = f"""# Marco 3C — pacote de auditoria, ciclo {cycle}

SIMULAÇÃO SEM VALOR OFICIAL. Laboratório sintético local; inspeção passiva.
Origem {origin_id}, SHA-256 {origin_hash}. O manifesto anterior e versões
relevantes permitem confrontar o delta. No ciclo 2, o ZIP imutável da origem
também está incluído. A aprovação visual foi concedida para
as telas do Colaborador e Gestão em 100% e 200%. Nenhum dado real, dump,
credencial, endereço não-loopback ou cookie foi incluído. Os logs de testes
são provas locais, não execução pelo auditor. Suítes sobrepostas não se somam.
O recibo do scan direto do ZIP fica fora dele por autorreferência.
Não é baseline, produção, publicação, ponto oficial nem REP-P.
Supabase remoto intocado; Marco seguinte não iniciado.
""".encode()

files = [{"path": name, "bytes": len(data), "sha256": digest(data)} for name, data in sorted(payload.items())]
delta = [{"path": name, "kind": "novo_no_arquivo" if name not in old_files else "alterado",
          "old_sha256": old_files.get(name), "current_sha256": digest(data)}
         for name, data in sorted(payload.items()) if not name.startswith("BASELINE_3B_")
         and old_files.get(name) != digest(data)]
manifest = {
    "id": f"METALLO-3C-AUDITORIA-CICLO{cycle}", "is_approved_baseline": False,
    "at": datetime.now(timezone.utc).isoformat(),
    "origin": {"id": origin_id, "sha256": origin_hash},
    "visual_approval": "responsável aprovou Colaborador e Gestão em 100% e 200% em 28/09/2026",
    "mandatory_label": "SIMULAÇÃO SEM VALOR OFICIAL",
    "results": {"3C_Auth_JWT_PostgREST": f"{expected_checks}/{expected_checks}", "3B_regression": "48/48",
                "Web": "142/142 após 140/141 sob carga, 9/9 isolado e 141/141 serial" if cycle == "2" else "141/141 após 140/141 sob carga", "banco": "31/31",
                "qualidade": "44/44", "rede_vigente_sem_alteracao": "8/8",
                "TypeScript_lint_build": "aprovados"},
    "overlapping_suites_do_not_sum": True,
    "scope": "laboratório local sintético; remoto intocado; sem publicação ou baseline 3C",
    "audit_mode": "somente inspeção passiva; proibida execução do projeto e acesso à rede",
    "files": files, "inventory_count": len(files), "delta_from_3b": delta,
    "zip_entries": len(files) + 1,
    "secret_scan_receipt": target.relative_to(root).as_posix() + ".verificacao.json",
}
payload["MANIFESTO_SHA256.json"] = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode()
with zipfile.ZipFile(target, "x", zipfile.ZIP_DEFLATED) as archive:
    for name, data in sorted(payload.items()):
        archive.writestr(name, data)
with zipfile.ZipFile(target) as archive:
    assert len(archive.namelist()) == manifest["zip_entries"]
    assert all(digest(archive.read(row["path"])) == row["sha256"] for row in files)
print(json.dumps({"zip": str(target), "sha256": digest(target.read_bytes()),
                  "entries": manifest["zip_entries"], "delta": len(delta)}, ensure_ascii=False))
