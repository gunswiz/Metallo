"""Congela a fotografia 3E autorizada e verifica todas as entradas do ZIP final.

Não executa testes, SQL ou auditoria. Lê apenas arquivos e status do Docker local.
"""

import ast
from datetime import datetime, timezone
import hashlib
from io import BytesIO
import json
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import sys
import zipfile

from pypdf import PdfReader

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parents[2]
OUTPUTS = ROOT / "outputs"
LAB = ROOT / "04_BANCO_E_SUPABASE/laboratorio-marco-3e"
ID = "METALLO-3E-LAB-20260929-R1"
PARENT_ID = "METALLO-3D-LAB-20260929-R1"
PARENT_SHA = "4246426837e90324b1e2242ca2162dd0d2b0d3cd49c72abb8c209283ec6b9516"
PARENT = OUTPUTS / "Metallo-Marco3D-BaselineAprovada-20260929-R1.zip"
TARGET = OUTPUTS / "Metallo-Marco3E-BaselineAprovada-20260929-R1.zip"
DOC = "05_DOCUMENTACAO/43_MARCO_3E_FICHA_HISTORICO_EPI_PDF.md"
AUDITS = {
    1: "aa0d72bd950cb7eefe1c93afcbfd315da65cf8c769de17ccd0e08bf212a68570",
    2: "d2ea506abafa677f5d87b9df69e63bf05a99893e2223ee8ae41a917ecdf0011f",
}
OPINIONS = {
    1: "500e41187d4bb373eff05d81c7fcd2d09c8acda80f861c242e60424a88b0ee46",
    2: "e9fe2e450ca2eef5f99222de69e5a220ac2a59416ae88b38c9e48647c38841a8",
}


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def read(name):
    return (ROOT / name).read_bytes()


# Reutiliza definições existentes por AST, sem executar o fechamento anterior.
scanner_source = ROOT / "04_BANCO_E_SUPABASE/laboratorio-marco-3d/gerar-baseline-3d.py"
tree = ast.parse(scanner_source.read_text(encoding="utf-8-sig"))
nodes = [node for node in tree.body if
         isinstance(node, ast.FunctionDef) and node.name in {"checked_archive", "local_secrets"}
         or isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "PATTERNS"
                                               for t in node.targets)]
assert len(nodes) == 3
helpers = {"ROOT": ROOT, "Path": Path, "json": json, "re": re, "zipfile": zipfile, "sha": sha}
exec(compile(ast.Module(body=nodes, type_ignores=[]), str(scanner_source), "exec"), helpers)

for path in (TARGET, Path(str(TARGET) + ".sha256"), Path(str(TARGET) + ".verificacao.json")):
    assert not path.exists(), f"Não sobrescrever: {path.name}"
assert not (ROOT / "04_BANCO_E_SUPABASE/laboratorio-marco-1a/supabase/.temp/project-ref").exists()
previous = {p.name: sha(p.read_bytes()) for p in OUTPUTS.glob("Metallo-*-Baseline*.zip")}
assert previous[PARENT.name] == PARENT_SHA
parent_manifest, parent = helpers["checked_archive"](PARENT, PARENT_ID)
audit_info = {}
for cycle, expected in AUDITS.items():
    path = OUTPUTS / f"Metallo-Marco3E-FichaHistorico-Auditoria-20260929-Ciclo{cycle}.zip"
    assert sha(path.read_bytes()) == expected
    receipt = json.loads(Path(str(path) + ".verificacao.json").read_text(encoding="utf-8-sig"))
    assert receipt["passed"] and receipt["findings"] == [] and receipt["zip"]["sha256"] == expected
    m, files = helpers["checked_archive"](path, f"METALLO-3E-AUDITORIA-CICLO{cycle}")
    assert sha(read(f"04_BANCO_E_SUPABASE/laboratorio-marco-3e/parecer-grok-ciclo{cycle}.md")) == OPINIONS[cycle]
    audit_info[cycle] = {"zip": path.name, "sha256": expected, "entries": m["zip_entries"],
                         "opinion_sha256": OPINIONS[cycle], "direct_scan_passed": True}
    if cycle == 2:
        audit_manifest, audited = m, files
assert audit_manifest["zip_entries"] == 97

result = json.loads(read("04_BANCO_E_SUPABASE/laboratorio-marco-3e/resultado-3e.json"))
assert len(result["checks"]) == 55 and all(c["ok"] for c in result["checks"])
assert "55/55" in (LAB / "provas-fechamento.log").read_text(encoding="utf-8-sig")
assert "exit_code=0" in (LAB / "provas-fechamento.log").read_text(encoding="utf-8-sig")
assert "25 passed (25)" in (LAB / "unitarios-consistencia-final.log").read_text(encoding="utf-8-sig")
for label in ("typecheck-consistencia-final", "lint-consistencia-final"):
    assert "exit_code=0" in (LAB / f"{label}.log").read_text(encoding="utf-8-sig")
for cycle in (1, 2):
    log = (LAB / f"web-ciclo2-sequencial-{cycle}.log").read_text(encoding="utf-8-sig")
    assert "165 passed (165)" in log and "exit_code=0" in log
qa = json.loads((LAB / "resultado-pdfs-simplificacao-3e.json").read_text(encoding="utf-8-sig"))
assert qa["secret_scan"]["passed"] and not qa["secret_scan"]["findings"]
for pdf in qa["pdfs"]:
    assert sha(read(pdf["path"])) == pdf["sha256"] and pdf["a4"]

# Somente a projeção humana/prévias/testes e evidências mudaram depois do ciclo 2.
presentation_sources = {
    "01_WEB/03_FUNCOES_E_LOGICA/Relatorios/epi-report-3e.ts",
    "01_WEB/03_FUNCOES_E_LOGICA/Relatorios/epi-report-3e-pdf.ts",
    "01_WEB/app/colaborador/[[...screen]]/epi-relatorios.tsx",
    "01_WEB/app/(02_SISTEMA)/funcionarios/[id]/epi/page.tsx",
    "01_WEB/10_TESTES/epi-report-3e.test.ts",
    "01_WEB/10_TESTES/colaborador-relatorios-epi.test.tsx",
}
allowed_updates = presentation_sources | {DOC,
    "04_BANCO_E_SUPABASE/laboratorio-marco-3e/resultado-3e.json"} | {p["path"] for p in qa["pdfs"]}
payload = dict(parent)
post_audit_delta = []
for name, raw in audited.items():
    if name == "LEIA-ME.md":
        continue
    current = ROOT / name
    if current.is_file():
        new = current.read_bytes()
        if sha(new) != sha(raw):
            assert name in allowed_updates, f"Mudança pós-auditoria não aprovada: {name}"
            post_audit_delta.append({"path": name, "audited_sha256": sha(raw), "final_sha256": sha(new)})
        raw = new
    payload[name] = raw
for item in qa["unchanged_security_files"]:
    assert sha(read(item["path"])) == item["sha256"] == sha(audited[item["path"]])

lab_prefix = "04_BANCO_E_SUPABASE/laboratorio-marco-3e/"
extra_names = ["parecer-grok-ciclo2.md", "grok-ciclo2.png", "resultado-pdfs-simplificacao-3e.json",
    "provas-fechamento.log", "provas-simplificacao.log", "unitarios-simplificacao.log",
    "unitarios-simplificacao-final.log", "unitarios-ca-final.log", "unitarios-consistencia-final.log",
    "typecheck-simplificacao.log", "typecheck-ca-final.log", "typecheck-consistencia-final.log",
    "lint-simplificacao.log", "lint-ca-final.log", "lint-consistencia-final.log", "gerar-baseline-3e.py"]
for name in extra_names:
    payload[lab_prefix + name] = read(lab_prefix + name)
for cycle in (1, 2):
    name = f"outputs/Metallo-Marco3E-FichaHistorico-Auditoria-20260929-Ciclo{cycle}.zip.verificacao.json"
    payload[name] = read(name)

point_paths = [name for name in parent if name.startswith("04_BANCO_E_SUPABASE/laboratorio-marco-2")
               and name.endswith((".mjs", ".sql"))]
for name in point_paths:
    assert sha(read(name)) == sha(parent[name]) == sha(payload[name]), f"Núcleo congelado alterado: {name}"
limits = ["SIMULAÇÃO SEM VALOR OFICIAL", "SUPABASE REMOTO INTOCADO", "NÃO IMPLANTADO NO SUPABASE REMOTO",
    "NÃO LIBERADO PARA FUNCIONÁRIOS REAIS", "NÃO É PRODUÇÃO", "NÃO É CONFORMIDADE REP-P",
    "NÃO É AUTORIZAÇÃO DE PONTO OFICIAL", "NÃO AUTORIZA PUBLICAÇÃO", "NÚCLEO DE PONTO 2F CONGELADO",
    "SEM NOVO MARCO; SEM TERCEIRA AUDITORIA"]
payload["LEIA-ME.md"] = (f"# {ID}\n\nMARCO 3E — FICHA E HISTÓRICO DE EPI EM PDF FUNCIONAL EM LABORATÓRIO.\n\n"
    f"Origem imutável {PARENT_ID}, SHA-256 {PARENT_SHA}. Consulte {DOC}. "
    "Aprovação formal do responsável inclui quatro PDFs finais v3 e a semântica de troca. "
    "Dois ciclos Grok confrontaram v2; a projeção humana posterior passou na validação local, "
    "sem terceira auditoria. O manifesto contém inventário, hashes, delta desde 3D, resultados, "
    "aprovação e riscos. A fotografia é uma seleção de código/evidências, não checkout completo ou backup de banco. "
    "A aprovação do ZIP depende do recibo externo passed=true, zero achados e SHA-256 correspondente. "
    "O recibo e SHA do ZIP ficam fora dele para evitar autorreferência.\n\n" + "; ".join(limits) + ".\n").encode()
delta = [{"path": name, "kind": "alterado" if name in parent else "novo",
          "sha256_3d": sha(parent[name]) if name in parent else None, "sha256_3e": sha(raw)}
         for name, raw in sorted(payload.items()) if name not in parent or sha(parent[name]) != sha(raw)]
files = [{"path": name, "bytes": len(raw), "sha256": sha(raw),
          "source": "3d_preservado" if name in parent and sha(raw) == sha(parent[name]) else "3e_atualizado"}
         for name, raw in sorted(payload.items())]
manifest = {"id": ID, "at": datetime.now(timezone.utc).isoformat(), "is_approved_baseline": True,
    "status": "MARCO 3E — FICHA E HISTÓRICO DE EPI EM PDF FUNCIONAL EM LABORATÓRIO",
    "parent": {"id": PARENT_ID, "zip": PARENT.name, "sha256": PARENT_SHA, "immutable": True},
    "document": DOC, "formal_approval": {"by": "responsável", "date": "2026-09-29",
        "baseline_explicitly_authorized": ID, "final_v3_pdfs_and_semantic_rule_approved": True,
        "scope": "fechamento e fotografia local; não publicar nem iniciar outro marco"},
    "results": {"3e_real_final_once": "55/55", "3e_real_final_at": result["at"],
        "audited_3e_real": "55/55", "audited_Web_two_separate_runs": ["165/165", "165/165"],
        "post_audit_affected": "25/25", "post_audit_TypeScript": "aprovado", "post_audit_lint": "aprovado",
        "historical_suites_not_repeated": True, "overlapping_suites_do_not_sum": True},
    "audits": {"cycles": 2, "critical_or_high_confirmed_open": 0, "findings_confronted": 12,
        "classifications": {"VALID": 7, "PARTIAL": 4, "INVALID": 1, "NOT_VERIFIABLE": 0},
        "cycle1": audit_info[1], "cycle2": audit_info[2], "original_opinions_included": True,
        "conversation1": "https://grok.com/c/fba7e169-f0e1-4efe-a403-b6f344abe051",
        "conversation2": "https://grok.com/c/28a4c840-d206-414f-81a0-4f86dea46b1d",
        "confrontation": DOC, "passive_inspection_only": True, "post_audit_v3_not_independently_audited": True,
        "third_cycle": False},
    "post_audit_changes": post_audit_delta, "post_audit_implementation_changes_only": sorted(presentation_sources),
    "post_audit_authorization_RLS_grants_delivery_3c_3d_stock_unchanged": True,
    "semantic_rule": "Entrega para troca não encerra anterior. SUBSTITUIÇÃO exige vínculo compatível e encerramento formal na data correspondente.",
    "current_sheet": "Somente estado formal active; dois ativos permanecem dois; sem encerramento inferido.",
    "visible_fields": ["título", "data", "EPI", "CA", "quantidade", "responsável nominal quando comprovado"],
    "internal_evidence_preserved": ["snapshots", "lote", "marca", "grupos", "IDs", "timestamps", "vínculos 3C",
        "confirmações", "divergências", "trilha de auditoria", "hashes técnicos"],
    "pdfs": qa["pdfs"], "printed_acknowledgement_not_retroactive": True, "hash_is_not_digital_signature": True,
    "residual_risks": ["legado sem snapshot/classificação histórica", "responsável nominal histórico ausente",
        "extração completa e limites SQL/PDF", "permissões herdadas", "sessão/revogação/token residual",
        "retenção e guarda pendentes", "identidade legal da empresa pendente", "gates jurídico/SST/DP/privacidade",
        "poder administrativo do host", "cópias baixadas externas", "segundo computador físico não testado"],
    "no_MTE_homologation_or_legal_guarantee": True, "limits": limits,
    "point_core_files_verified_unchanged": point_paths, "remote_not_touched": True, "published": False,
    "delta_from_3d": delta, "delta_count": len(delta), "removed_from_3d": [],
    "inventory_count": len(files), "files": files, "zip_entries": len(files) + 1,
    "secret_scan_receipt": TARGET.name + ".verificacao.json",
    "approval_condition": "scan direto passed=true, zero achados, com SHA-256 exato do ZIP"}
payload["MANIFESTO_SHA256.json"] = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode()

known = helpers["local_secrets"]()
status = subprocess.run(["node", str(ROOT / "node_modules/supabase/dist/supabase.js"), "status", "--workdir",
                         str(ROOT / "04_BANCO_E_SUPABASE/laboratorio-marco-1a"), "-o", "json"],
                        capture_output=True, text=True, check=True)
settings = json.loads(status.stdout)
assert settings["API_URL"] == "http://127.0.0.1:54321"
known.update(settings[k] for k in ("SERVICE_ROLE_KEY", "JWT_SECRET", "SECRET_KEY") if settings.get(k))
# Permite somente coincidências sintáticas previamente examinadas, por caminho e hash exatos.
accepted = {}
for scan in (json.loads((LAB / "resultado-segredos-3e.json").read_text(encoding="utf-8-sig")),
             json.loads(read("outputs/Metallo-Marco3E-FichaHistorico-Auditoria-20260929-Ciclo2.zip.verificacao.json"))):
    for row in scan["triage"]:
        for match in row["matches"]:
            if match["classification"] == "NOT_SECRET":
                accepted[(row["path"], row["kind"], match["match_sha256"])] = match

with zipfile.ZipFile(TARGET, "x", zipfile.ZIP_DEFLATED) as archive:
    for name, raw in sorted(payload.items()):
        archive.writestr(name, raw)

findings, alerts, triage, pdfs = [], [], [], []
with zipfile.ZipFile(TARGET) as archive:
    assert archive.testzip() is None
    names = archive.namelist()
    assert len(names) == len(set(names)) == manifest["zip_entries"]
    assert set(names) == {row["path"] for row in files} | {"MANIFESTO_SHA256.json"}
    for row in files:
        raw = archive.read(row["path"])
        assert len(raw) == row["bytes"] and sha(raw) == row["sha256"], row["path"]
    for item in archive.infolist():
        name, parts = item.filename, PurePosixPath(item.filename).parts
        if (item.is_dir() or stat.S_ISLNK(item.external_attr >> 16) or not parts or name.startswith("/")
            or ".." in parts or ":" in name or "\\" in name
            or any(p.lower() in {"backups", "node_modules", ".git", ".temp", "cookies", "credentials", "credenciais"}
                   or p.lower().startswith((".env", ".next")) for p in parts)
            or re.search(r"\.(?:pem|pfx|p12|key|sqlite|db|dump|bak|pgdump|zip|map)$", name, re.I)):
            findings.append({"path": name, "kind": "arquivo/caminho indevido"})
        raw = archive.read(item)
        text = raw.decode("utf-8-sig", errors="ignore")
        if name.lower().endswith(".pdf"):
            reader = PdfReader(BytesIO(raw))
            human = "\n".join(p.extract_text() or "" for p in reader.pages) + "\n" + str(reader.metadata)
            text += "\n" + human
            if re.search(r"\bCPF\b|\bASO\b|salário|internal_note|refresh_token", human, re.I):
                findings.append({"path": name, "kind": "campo pessoal indevido no PDF"})
            a4 = all(abs(float(p.mediabox.width)-595.28) < 1 and abs(float(p.mediabox.height)-841.89) < 1
                     for p in reader.pages)
            assert a4, name
            pdfs.append({"path": name, "pages": len(reader.pages), "sha256": sha(raw), "a4": a4,
                         "raw_text_metadata_scanned": True})
        for kind, pattern in helpers["PATTERNS"]:
            matches = list(re.finditer(pattern, text, re.I))
            if matches:
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
        if any(value in text for value in known):
            findings.append({"path": name, "kind": "credencial local conhecida"})

zip_sha = sha(TARGET.read_bytes())
preserved = all(sha((OUTPUTS / name).read_bytes()) == digest for name, digest in previous.items())
assert preserved
for cycle, expected in AUDITS.items():
    assert sha((OUTPUTS / audit_info[cycle]["zip"]).read_bytes()) == expected
receipt = {"at": datetime.now(timezone.utc).isoformat(), "id": ID,
    "scope": "secret scan diretamente em todas as entradas do ZIP final, PDFs em bytes/texto/metadados",
    "zip": {"path": TARGET.relative_to(ROOT).as_posix(), "sha256": zip_sha, "entries": len(names),
            "manifest_files_verified": len(files)}, "delta_from_3d": len(delta),
    "known_local_credentials_checked": len(known), "patterns_checked": [n for n, _ in helpers["PATTERNS"]],
    "initial_raw_alerts": alerts, "triage": triage, "values_redacted": True, "pdfs": pdfs,
    "findings": findings, "passed": not findings, "is_approved_baseline": not findings,
    "previous_baselines_preserved": preserved, "audit_cycles_preserved": True,
    "remote_not_touched": True, "published": False}
Path(str(TARGET) + ".verificacao.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
if findings:
    print(json.dumps({"passed": False, "findings": findings}, ensure_ascii=False))
    raise SystemExit(1)
Path(str(TARGET) + ".sha256").write_text(f"{zip_sha}  {TARGET.name}\n", encoding="ascii")
TARGET.chmod(0o444)
print(json.dumps({"passed": True, "id": ID, "zip": str(TARGET), "sha256": zip_sha,
    "inventory_files": len(files), "entries": len(names), "delta_from_3d": len(delta),
    "zero_confirmed_secret_findings": True, "previous_baselines_preserved": preserved}, ensure_ascii=False))
