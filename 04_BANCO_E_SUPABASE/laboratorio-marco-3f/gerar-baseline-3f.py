"""Congela a fotografia 3F autorizada e examina diretamente o ZIP final.

Somente arquivos locais. Não executa SQL, testes, deploy ou conexão remota.
"""

import ast
from datetime import datetime, timezone
import hashlib
from io import BytesIO
import json
from pathlib import Path, PurePosixPath
import re
import stat
import sys
import zipfile

from pypdf import PdfReader


sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parents[2]
OUTPUTS = ROOT / "outputs"
LAB = ROOT / "04_BANCO_E_SUPABASE/laboratorio-marco-3f"
ID = "METALLO-3F-LAB-20260929-R1"
PARENT_ID = "METALLO-3E-LAB-20260929-R1"
PARENT_SHA = "7ffb4707ae0a6bd2c12cd5756284582cba8c4f31673569207b0a0552a3d86c8c"
PARENT = OUTPUTS / "Metallo-Marco3E-BaselineAprovada-20260929-R1.zip"
TARGET = OUTPUTS / "Metallo-Marco3F-BaselineAprovada-20260929-R1.zip"
DOC = "05_DOCUMENTACAO/44_MARCO_3F_ASSINATURA_RECEBIMENTO_EPI.md"
AUDITS = {
    1: ("3b56137011c56c43e3b97a0891d878082fa6a4a5a79328770faa0d9b982c2579", 37, 38),
    2: ("043c0d4177862e5d9ba091c9aa051ddf37f248518e17e5c2b5118f72c012cf54", 41, 42),
}
OPINIONS = {
    1: "a1614c8da210e8d45f45e7bdab71e163a4d28184f12cfcd553b2523d15f88a08",
    2: "bb4eb43ba271a97133652b7b2e7a345a015f35608005c8c9df273046faa39f30",
}


def sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def read(name: str) -> bytes:
    return (ROOT / name).read_bytes()


# As rotinas de conferência e os padrões já aprovados nas baselines anteriores
# são reutilizados sem executar o script de fechamento do 3D.
source = ROOT / "04_BANCO_E_SUPABASE/laboratorio-marco-3d/gerar-baseline-3d.py"
tree = ast.parse(source.read_text(encoding="utf-8-sig"))
nodes = [node for node in tree.body if
         isinstance(node, ast.FunctionDef) and node.name in {"checked_archive", "local_secrets"}
         or isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "PATTERNS"
                                                 for t in node.targets)]
assert len(nodes) == 3
helpers = {"ROOT": ROOT, "Path": Path, "json": json, "re": re, "zipfile": zipfile, "sha": sha}
exec(compile(ast.Module(body=nodes, type_ignores=[]), str(source), "exec"), helpers)

for path in (TARGET, Path(str(TARGET) + ".sha256"), Path(str(TARGET) + ".verificacao.json")):
    assert not path.exists(), f"Não sobrescrever: {path.name}"
assert not (ROOT / "04_BANCO_E_SUPABASE/laboratorio-marco-1a/supabase/.temp/project-ref").exists(), "Laboratório ligado ao remoto"
assert not list((ROOT / "04_BANCO_E_SUPABASE/supabase/migrations").glob("*3f*")), "Migration 3F fora do laboratório"
previous = {p.name: sha(p.read_bytes()) for p in OUTPUTS.glob("Metallo-*-BaselineAprovada*.zip")}
assert previous[PARENT.name] == PARENT_SHA, "Baseline 3E alterada"
parent_manifest, parent = helpers["checked_archive"](PARENT, PARENT_ID)
assert parent_manifest["is_approved_baseline"] and parent_manifest["inventory_count"] == 235
parent_hashes = {name: sha(raw) for name, raw in parent.items()}

audits = {}
for cycle, (expected, files, entries) in AUDITS.items():
    path = OUTPUTS / f"Metallo-Marco3F-AssinaturaAuditoria-20260929-Ciclo{cycle}.zip"
    assert sha(path.read_bytes()) == expected, f"Pacote Grok ciclo {cycle} alterado"
    receipt_path = Path(str(path) + ".verificacao.json")
    receipt = json.loads(receipt_path.read_text(encoding="utf-8-sig"))
    assert receipt["passed"] and not receipt["findings"] and receipt["zip"]["sha256"] == expected
    audit_manifest, audit_files = helpers["checked_archive"](path, f"METALLO-3F-AUDITORIA-CICLO{cycle}")
    assert audit_manifest["inventory_count"] == files and audit_manifest["zip_entries"] == entries
    opinion_name = f"04_BANCO_E_SUPABASE/laboratorio-marco-3f/parecer-grok-ciclo{cycle}-original.pdf"
    assert sha(read(opinion_name)) == OPINIONS[cycle]
    audits[str(cycle)] = {"zip": path.name, "sha256": expected, "files": files, "entries": entries,
                          "direct_scan_passed": True, "opinion_sha256": OPINIONS[cycle],
                          "conversation": "https://grok.com/c/62328b38-01e7-4ffa-a24e-7812120979c5" if cycle == 1
                          else "https://grok.com/c/8bc28162-61d5-47a9-9ff0-92312e64bd7a"}
    if cycle == 2:
        final_audit_files = audit_files

result = json.loads(read("04_BANCO_E_SUPABASE/laboratorio-marco-3f/resultado-3f.json"))
assert result["passed"] == result["total"] == len(result["checks"]) == 58
assert all(check["ok"] for check in result["checks"])
web_log = read("04_BANCO_E_SUPABASE/laboratorio-marco-3f/web-ciclo1-final.log").decode("utf-8-sig")
assert "28 passed (28)" in web_log and "185 passed (185)" in web_log
build_log = read("04_BANCO_E_SUPABASE/laboratorio-marco-3f/build-ciclo1-final.log").decode("utf-8-sig")
assert "Compiled successfully" in build_log and "Finished TypeScript" in build_log
assert "58/58" in read(DOC).decode("utf-8-sig") and "16/16" in read(DOC).decode("utf-8-sig")
assert "185/185" in read(DOC).decode("utf-8-sig")

# A auditoria do ciclo 2 fixou o código. Somente o documento 44 recebeu o
# confronto final e a autorização de fechamento depois daquele pacote.
for name, raw in final_audit_files.items():
    if name.startswith(("BASELINE_", "LEIA-ME", "PROMPT_")) or name == DOC:
        continue
    assert sha(read(name)) == sha(raw), f"Arquivo pós-auditoria divergente: {name}"

payload = dict(parent)
for name, raw in final_audit_files.items():
    if name.startswith(("BASELINE_", "LEIA-ME", "PROMPT_")) or name == DOC:
        continue
    payload[name] = raw
payload[DOC] = read(DOC)
payload["BASELINE_3E_MANIFESTO.json"] = (json.dumps(parent_manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
payload["pnpm-lock.yaml"] = read("pnpm-lock.yaml")

extra = [
    "04_BANCO_E_SUPABASE/laboratorio-marco-3f/parecer-grok-ciclo2-original.pdf",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3f/gerar-baseline-3f.py",
]
for name in extra:
    payload[name] = read(name)
for cycle in AUDITS:
    base = f"outputs/Metallo-Marco3F-AssinaturaAuditoria-20260929-Ciclo{cycle}.zip"
    for suffix in (".verificacao.json", ".sha256"):
        payload[base + suffix] = read(base + suffix)

point_paths = [name for name in parent if name.startswith("04_BANCO_E_SUPABASE/laboratorio-marco-2f/")
               and name.endswith((".mjs", ".sql"))]
for name in point_paths:
    assert sha(read(name)) == parent_hashes[name] == sha(payload[name]), f"Núcleo 2F alterado: {name}"
pdf_3e_paths = [name for name in parent if name.startswith("outputs/marco-3e-previa-sintetica/")
                and name.endswith(".pdf")]
assert len(pdf_3e_paths) == 4
for name in pdf_3e_paths:
    assert sha(read(name)) == parent_hashes[name] == sha(payload[name]), f"PDF 3E alterado: {name}"

limits = ["SIMULAÇÃO SEM VALOR OFICIAL", "NÃO IMPLANTADO NO SUPABASE REMOTO",
          "NÃO LIBERADO PARA FUNCIONÁRIOS REAIS", "NÃO É PRODUÇÃO", "NÃO É CONFORMIDADE REP-P",
          "NÃO É AUTORIZAÇÃO DE PONTO OFICIAL", "NÃO AUTORIZA PUBLICAÇÃO", "NÚCLEO 2F CONGELADO",
          "BASELINE 3E CONGELADA", "SEM TERCEIRO CICLO GROK", "SEM INÍCIO DO MARCO 3G"]
payload["LEIA-ME.md"] = (f"# {ID}\n\nMARCO 3F — ASSINATURA DE RECEBIMENTO DE EPI COM CREDENCIAL "
    "PESSOAL REFORÇADA FUNCIONAL EM LABORATÓRIO.\n\n"
    f"Origem imutável: {PARENT_ID}, SHA-256 {PARENT_SHA}. Consulte {DOC}. "
    "Fotografia selecionada de código, SQL local, testes, documentos e evidências; não é checkout "
    "executável nem backup de banco. O manifesto lista inventário, delta completo, hashes, auditorias, "
    "aprovação manual, riscos e limites. O SHA do ZIP e seu exame direto ficam em recibos externos "
    "para evitar autorreferência. A aprovação da baseline depende de passed=true e zero achados "
    "no recibo de scan do ZIP exato.\n\n" + "; ".join(limits) + ".\n").encode("utf-8")

delta = [{"path": name, "kind": "alterado" if name in parent else "novo",
          "sha256_3e": parent_hashes.get(name), "sha256_3f": sha(raw)}
         for name, raw in sorted(payload.items()) if parent_hashes.get(name) != sha(raw)]
removed = sorted(set(parent) - set(payload))
assert not removed, "Remoções inesperadas desde 3E"
inventory = [{"path": name, "bytes": len(raw), "sha256": sha(raw),
              "source": "3e_preservado" if parent_hashes.get(name) == sha(raw) else "3f_atualizado"}
             for name, raw in sorted(payload.items())]
manifest = {
    "id": ID, "at": datetime.now(timezone.utc).isoformat(), "is_approved_baseline": True,
    "status": "MARCO 3F — ASSINATURA DE RECEBIMENTO DE EPI COM CREDENCIAL PESSOAL REFORÇADA FUNCIONAL EM LABORATÓRIO",
    "parent": {"id": PARENT_ID, "zip": PARENT.name, "sha256": PARENT_SHA, "immutable": True},
    "document": DOC, "formal_approval": {"by": "responsável", "date": "2026-09-29",
        "baseline_explicitly_authorized": ID, "manual_preview_100_and_200_approved": True,
        "real_passkey_ceremony_approved": True, "local_only": True},
    "results": {"3f_integrated_real_auth_jwt_postgrest_and_synthetic_webauthn": "58/58",
        "affected_focused": "16/16", "web_complete": "185/185", "TypeScript": "aprovado",
        "directed_lint": "aprovado", "build": "aprovado", "overlapping_suites_do_not_sum": True,
        "grok_did_not_rerun_tests": True},
    "audits": {"cycles": 2, "cycle1": audits["1"], "cycle2": audits["2"],
        "findings_confronted": 34, "classifications": {
            "VALID": "01,03-13,15-16,18-19,20-26,28,31-33",
            "PARTIAL": "02,14,17,29,34", "INVALID": "27", "NOT_VERIFIABLE": "30"},
        "corrected": ["F-3F-12", "F-3F-24"], "up_absent_rejected_locally": "F-3F-27",
        "critical_or_high_confirmed_open": 0, "original_opinions_included": True,
        "confrontation": DOC, "passive_inspection_only": True, "third_cycle": False},
    "legal_status": "CANDIDATO TÉCNICO A ASSINATURA ELETRÔNICA AVANÇADA; depende de revisão jurídica específica",
    "private_key_on_authenticator_not_server": True, "payload_sha256_is_not_signature": True,
    "common_confirmation_is_not_reinforced": True, "revocation_blocks_future_not_history": True,
    "medium_risks_open": ["F-3F-08", "F-3F-10", "F-3F-14", "F-3F-18", "F-3F-19", "F-3F-22", "F-3F-25"],
    "future_gates": ["advogado trabalhista", "SST", "privacidade e segurança", "opcional versus obrigatório",
        "recuperação de conta", "revogação administrativa", "aparelho perdido", "múltiplos dispositivos",
        "BYOD", "desligamento", "retenção", "suporte operacional", "revisão dos riscos médios"],
    "local_sql_only": "04_BANCO_E_SUPABASE/laboratorio-marco-3f/contrato-assinatura-local.sql",
    "remote_not_touched": True, "published": False, "point_core_files_verified_unchanged": point_paths,
    "approved_3e_pdfs_verified_unchanged": pdf_3e_paths, "limits": limits,
    "delta_from_3e": delta, "delta_count": len(delta), "removed_from_3e": removed,
    "inventory_count": len(inventory), "files": inventory, "zip_entries": len(inventory) + 1,
    "secret_scan_receipt": TARGET.name + ".verificacao.json",
    "approval_condition": "scan direto passed=true, zero achados, SHA-256 exato do ZIP",
}
payload["MANIFESTO_SHA256.json"] = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")

with zipfile.ZipFile(TARGET, "x", zipfile.ZIP_DEFLATED) as archive:
    for name, raw in sorted(payload.items()):
        archive.writestr(name, raw)

# Novo exame sobre o ZIP já gravado, sem confiar no payload em memória.
patterns = tuple(helpers["PATTERNS"]) + (
    ("access token literal", r"(?:access_token|accessToken)\s*[=:]\s*[\"'][A-Za-z0-9._-]{24,}[\"']"),
    ("WebAuthn private key JWK", r"[\"']d[\"']\s*:\s*[\"'][A-Za-z0-9_-]{32,}[\"']"),
)
known = helpers["local_secrets"]()
for env_file in (ROOT / "01_WEB").glob(".env*"):
    if not env_file.is_file():
        continue
    for line in env_file.read_text(encoding="utf-8-sig", errors="ignore").splitlines():
        match = re.match(r"\s*(?:export\s+)?([A-Za-z0-9_]*(?:SECRET|TOKEN|PASSWORD|KEY)[A-Za-z0-9_]*)\s*=\s*(.+?)\s*$", line, re.I)
        if match:
            value = match.group(2).strip("\"'")
            if len(value) >= 12:
                known.add(value)
parent_receipt = json.loads(Path(str(PARENT) + ".verificacao.json").read_text(encoding="utf-8-sig"))
assert parent_receipt["passed"] and not parent_receipt["findings"]
accepted = {(row["path"], row["kind"], item["match_sha256"]): item
            for row in parent_receipt.get("triage", []) for item in row["matches"]
            if item.get("classification") == "NOT_SECRET"}
findings, alerts, triage, pdfs = [], [], [], []
with zipfile.ZipFile(TARGET) as archive:
    assert archive.testzip() is None, "ZIP final corrompido"
    names = archive.namelist()
    assert len(names) == len(set(names)) == manifest["zip_entries"]
    assert set(names) == {row["path"] for row in inventory} | {"MANIFESTO_SHA256.json"}
    for row in inventory:
        raw = archive.read(row["path"])
        assert len(raw) == row["bytes"] and sha(raw) == row["sha256"], row["path"]
    for item in archive.infolist():
        name = item.filename
        parts = PurePosixPath(name).parts
        if (item.is_dir() or stat.S_ISLNK(item.external_attr >> 16) or not parts or name.startswith("/")
            or ".." in parts or ":" in name or "\\" in name
            or any(part.lower() in {"backups", "node_modules", ".git", ".temp", ".next", "cookies",
                                     "credentials", "credenciais", "storage"}
                   or part.lower().startswith(".env") for part in parts)
            or name.lower().endswith((".pem", ".pfx", ".p12", ".key", ".sqlite", ".db",
                                      ".dump", ".bak", ".pgdump", ".zip", ".map"))):
            findings.append({"path": name, "kind": "arquivo/caminho indevido"})
        raw = archive.read(item)
        content = raw.decode("utf-8-sig", errors="ignore")
        if name.lower().endswith(".pdf"):
            reader = PdfReader(BytesIO(raw))
            content += "\n" + "\n".join(page.extract_text() or "" for page in reader.pages) + "\n" + str(reader.metadata)
            pdfs.append({"path": name, "pages": len(reader.pages), "sha256": sha(raw),
                         "bytes_text_metadata_scanned": True})
        for kind, pattern in patterns:
            matches = list(re.finditer(pattern, content, re.I))
            if matches:
                alerts.append({"path": name, "kind": kind, "occurrences": len(matches)})
                decisions = []
                for match in matches:
                    digest = sha(match.group().encode())
                    decision = accepted.get((name, kind, digest))
                    if decision and parent_hashes.get(name) == sha(raw):
                        decisions.append(decision)
                    else:
                        findings.append({"path": name, "kind": kind, "match_sha256": digest})
                triage.append({"path": name, "kind": kind, "matches": decisions})
        if any(secret in content for secret in known):
            findings.append({"path": name, "kind": "credencial local conhecida"})

zip_sha = sha(TARGET.read_bytes())
preserved = all(sha((OUTPUTS / name).read_bytes()) == digest for name, digest in previous.items())
assert preserved, "Baseline anterior alterada"
for cycle, (expected, _, _) in AUDITS.items():
    path = OUTPUTS / audits[str(cycle)]["zip"]
    assert sha(path.read_bytes()) == expected
receipt = {"at": datetime.now(timezone.utc).isoformat(), "id": ID,
    "scope": "scan direto de todas as entradas do ZIP final 3F, PDFs em bytes/texto/metadados",
    "zip": {"path": TARGET.relative_to(ROOT).as_posix(), "sha256": zip_sha,
            "bytes": TARGET.stat().st_size, "entries": len(names), "manifest_files_verified": len(inventory)},
    "delta_from_3e": {"new": sum(x["kind"] == "novo" for x in delta),
                      "changed": sum(x["kind"] == "alterado" for x in delta), "removed": len(removed)},
    "known_local_credentials_checked": len(known), "patterns_checked": [kind for kind, _ in patterns],
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
                  "size_bytes": TARGET.stat().st_size, "files": len(inventory), "entries": len(names),
                  "delta": receipt["delta_from_3e"], "zero_confirmed_secrets": True,
                  "prior_baselines_preserved": preserved}, ensure_ascii=False))
