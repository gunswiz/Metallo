"""Congela o Marco 3G autorizado e examina diretamente o ZIP final.

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
LAB = ROOT / "04_BANCO_E_SUPABASE/laboratorio-marco-3g"
ID = "METALLO-3G-LAB-20260930-R1"
PARENT_ID = "METALLO-3F-LAB-20260929-R1"
PARENT_SHA = "76e964041e3f4a06ce4c11cc0fdc58fa8a3429bb68d8db2a4a248918356ea3d4"
PARENT = OUTPUTS / "Metallo-Marco3F-BaselineAprovada-20260929-R1.zip"
PDF_ORIGIN = OUTPUTS / "Metallo-Marco3E-BaselineAprovada-20260929-R1.zip"
PDF_ORIGIN_SHA = "7ffb4707ae0a6bd2c12cd5756284582cba8c4f31673569207b0a0552a3d86c8c"
TARGET = OUTPUTS / "Metallo-Marco3G-BaselineAprovada-20260930-R1.zip"
DOC = "05_DOCUMENTACAO/45_MARCO_3G_MEUS_ITENS_PESSOAIS.md"
AUDITS = {
    1: ("f8a7cb2af2eb2e4bf077b0cb610b9fe41015ddd73cc17ea41ebdaec544d91cd5", 48, 49),
    2: ("0a515284042bfed92583dd9a7b5d1f70052733f26044d94834ab0f6c4bc56039", 66, 67),
}


def sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def read(name: str) -> bytes:
    return (ROOT / name).read_bytes()


# Reutiliza o verificador de inventário e os padrões já usados nas baselines anteriores.
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
assert not (ROOT / "04_BANCO_E_SUPABASE/laboratorio-marco-1a/supabase/.temp/project-ref").exists()
assert not list((ROOT / "04_BANCO_E_SUPABASE/supabase/migrations").glob("*3g*"))
previous = {p.name: sha(p.read_bytes()) for p in OUTPUTS.glob("Metallo-*-Baseline*.zip")}
assert previous[PARENT.name] == PARENT_SHA
assert sha(PDF_ORIGIN.read_bytes()) == PDF_ORIGIN_SHA
parent_receipt = json.loads(Path(str(PARENT) + ".verificacao.json").read_text(encoding="utf-8-sig"))
assert parent_receipt["passed"] and not parent_receipt["findings"]
assert parent_receipt["zip"]["sha256"] == PARENT_SHA
parent_manifest, parent = helpers["checked_archive"](PARENT, PARENT_ID)
assert parent_manifest["is_approved_baseline"]
parent_hashes = {name: sha(raw) for name, raw in parent.items()}

audits = {}
for cycle, (expected, files, entries) in AUDITS.items():
    path = OUTPUTS / f"Metallo-Marco3G-ItensPessoais-Auditoria-20260930-Ciclo{cycle}.zip"
    assert sha(path.read_bytes()) == expected, f"Pacote Grok ciclo {cycle} alterado"
    receipt = json.loads(Path(str(path) + ".verificacao.json").read_text(encoding="utf-8-sig"))
    assert receipt["passed"] and not receipt["findings"] and receipt["zip"]["sha256"] == expected
    audit_manifest, audit_files = helpers["checked_archive"](path, f"METALLO-3G-AUDITORIA-CICLO{cycle}")
    assert audit_manifest["inventory_count"] == files and audit_manifest["zip_entries"] == entries
    opinion = f"04_BANCO_E_SUPABASE/laboratorio-marco-3g/parecer-grok-ciclo{cycle}-original.md"
    audits[str(cycle)] = {"zip": path.name, "sha256": expected, "files": files, "entries": entries,
                          "direct_scan_passed": True, "opinion": opinion,
                          "opinion_sha256": sha(read(opinion)),
                          "conversation": "https://grok.com/c/1623cf7a-5746-4cba-9379-091ca8d7c49c"}
    if cycle == 2:
        final_audit_files = audit_files

for name, count in (("resultado-3g.json", 34), ("resultado-estoque-3g.json", 68)):
    result = json.loads(read(f"04_BANCO_E_SUPABASE/laboratorio-marco-3g/{name}"))
    assert result["passed"] == result["total"] == len(result["checks"]) == count
    assert all(row["ok"] for row in result["checks"])
web = json.loads(read("04_BANCO_E_SUPABASE/laboratorio-marco-3g/web-final-3g.json"))
assert web["success"] and web["numPassedTests"] == web["numTotalTests"] == 210
assert web["numFailedTests"] == 0 and web["numPassedTestSuites"] == 48
doc = read(DOC).decode("utf-8-sig")
for required in ("68/68", "34/34", "210/210", "FUNCIONAL EM LABORATÓRIO",
                 "F-3G-15", "SIMULAÇÃO SEM VALOR OFICIAL", "APROVADA"):
    assert required in doc, required

# Só estes sete caminhos mudaram depois do segundo parecer. Cada diferença é
# declarada, testada localmente e preservada como delta pós-auditoria.
post_audit = {
    "01_WEB/02_COMPONENTES_VISUAIS/formulario-operacao.tsx",
    "01_WEB/10_TESTES/itens-pessoais-estoque-3g.test.tsx",
    "01_WEB/app/(02_SISTEMA)/funcionarios/[id]/itens/page.tsx",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3g/provas-estoque-3g.mjs",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3g/resultado-3g.json",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3g/resultado-estoque-3g.json",
    DOC,
}
payload = dict(parent)
actual_differences = set()
for name, raw in final_audit_files.items():
    if not name.startswith(("01_WEB/", "04_BANCO_E_SUPABASE/", "05_DOCUMENTACAO/")) and name != "AGENTS.md":
        continue
    if not (ROOT / name).is_file():
        continue
    current = read(name)
    if sha(current) != sha(raw):
        actual_differences.add(name)
        assert name in post_audit, f"Alteração não confrontada após Grok: {name}"
    payload[name] = current if name in post_audit else raw
assert actual_differences == post_audit, f"Delta pós-auditoria inesperado: {actual_differences ^ post_audit}"

additional = [
    "04_BANCO_E_SUPABASE/laboratorio-marco-3g/resolucao-pendencias-3g.sql",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3g/parecer-grok-ciclo2-original.md",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3g/web-final-3g.json",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3g/gerar-baseline-3g.py",
]
for name in additional:
    payload[name] = read(name)
for cycle in AUDITS:
    name = f"outputs/Metallo-Marco3G-ItensPessoais-Auditoria-20260930-Ciclo{cycle}.zip"
    for suffix in (".verificacao.json", ".sha256"):
        payload[name + suffix] = read(name + suffix)
payload["BASELINE_3F_MANIFESTO.json"] = (json.dumps(parent_manifest, ensure_ascii=False, indent=2) + "\n").encode()

point_paths = [name for name in parent if name.startswith("04_BANCO_E_SUPABASE/laboratorio-marco-2f/")
               and name.endswith((".mjs", ".sql"))]
for name in point_paths:
    assert sha(read(name)) == parent_hashes[name] == sha(payload[name]), f"Núcleo 2F alterado: {name}"
pdf_paths = [name for name in parent if name.startswith("outputs/marco-3e-previa-sintetica/")
             and name.endswith(".pdf")]
assert len(pdf_paths) == 4
for name in pdf_paths:
    assert sha(read(name)) == parent_hashes[name] == sha(payload[name]), f"PDF 3E alterado: {name}"

limits = ["SIMULAÇÃO SEM VALOR OFICIAL", "SUPABASE REMOTO INTOCADO",
          "NÃO IMPLANTADO NO SUPABASE REMOTO", "NÃO LIBERADO PARA FUNCIONÁRIOS REAIS",
          "NÃO É PRODUÇÃO", "NÃO É CONFORMIDADE REP-P", "NÃO É AUTORIZAÇÃO DE PONTO OFICIAL",
          "NÃO AUTORIZA PUBLICAÇÃO", "NÚCLEO 2F CONGELADO", "BASELINES 3E E 3F CONGELADAS",
          "SEM TERCEIRO CICLO GROK", "SEM INÍCIO DO MARCO 3H"]
payload["LEIA-ME.md"] = (f"# {ID}\n\nMARCO 3G — MEUS ITENS PESSOAIS + INTEGRAÇÃO COM ESTOQUE "
    f"FUNCIONAL EM LABORATÓRIO. Origem formal {PARENT_ID}, SHA-256 {PARENT_SHA}. "
    f"Origem histórica dos PDFs 3E: SHA-256 {PDF_ORIGIN_SHA}. Consulte {DOC}. "
    "Esta é uma fotografia selecionada de fontes e evidências, não checkout executável ou backup de banco. "
    "O manifesto traz inventário, delta desde 3F, resultados, dois pareceres Grok, decisões pós-auditoria "
    "e riscos. O SHA do ZIP e o scan direto ficam em recibos externos para evitar autorreferência. "
    "A baseline depende de passed=true, hash exato e zero segredos confirmados no recibo.\n\n"
    + "; ".join(limits) + ".\n").encode("utf-8")

delta = [{"path": name, "kind": "alterado" if name in parent else "novo",
          "sha256_3f": parent_hashes.get(name), "sha256_3g": sha(raw)}
         for name, raw in sorted(payload.items()) if parent_hashes.get(name) != sha(raw)]
removed = sorted(set(parent) - set(payload))
assert not removed, f"Remoções inesperadas desde 3F: {removed}"
inventory = [{"path": name, "bytes": len(raw), "sha256": sha(raw),
              "source": "3f_preservado" if parent_hashes.get(name) == sha(raw)
              else "3g_atualizado" if name in parent else "3g_adicionado"}
             for name, raw in sorted(payload.items())]
manifest = {
    "id": ID, "at": datetime.now(timezone.utc).isoformat(), "is_approved_baseline": True,
    "status": "MARCO 3G — MEUS ITENS PESSOAIS + INTEGRAÇÃO COM ESTOQUE FUNCIONAL EM LABORATÓRIO",
    "parent": {"id": PARENT_ID, "zip": PARENT.name, "sha256": PARENT_SHA, "immutable": True},
    "pdf_origin": {"id": "METALLO-3E-LAB-20260929-R1", "sha256": PDF_ORIGIN_SHA, "immutable": True},
    "document": DOC, "formal_approval": {"by": "responsável", "date": "2026-09-30",
        "baseline_explicitly_authorized": ID, "manual_preview_final_approved": True, "local_only": True},
    "results": {"3g_stock_idempotency_auth_return": "68/68", "3g_personal_contract": "34/34",
        "web_complete": "210/210", "TypeScript": "aprovado", "lint": "aprovado", "build": "aprovado",
        "overlapping_suites_do_not_sum": True, "web_report": "04_BANCO_E_SUPABASE/laboratorio-marco-3g/web-final-3g.json"},
    "audits": {"cycles": 2, "cycle1": audits["1"], "cycle2": audits["2"],
        "findings_confronted": 15, "critical_or_high_confirmed_open": 0,
        "confrontation": DOC, "passive_only": True, "third_cycle": False,
        "post_audit_local_decisions": ["F-3G-01", "F-3G-02", "F-3G-07"],
        "post_audit_files_changed": sorted(post_audit),
        "post_audit_files_added": additional,
        "post_audit_changes_not_independently_reaudited": True},
    "stock_source": "public.epi_stock_batches; sem estoque paralelo",
    "stock_and_delivery_same_transaction": True, "negative_balance_denied": True,
    "central_stock": "deny-by-default; administrador global ativo validado na RPC",
    "exceptional_delivery": "admin ativo, motivo estruturado e confirmação; sem movimento de saldo",
    "return_reusable": "somente lote original; operação administrativa após inativação sem reativar titular",
    "legacy_synthetic_deliveries": {"count": 39, "retroactive_batch_links": 0},
    "residual_risks": ["F-3G-15, hipótese de ordem semântica sem reprodução concreta",
        "somente laboratório sintético, sem estoque físico real",
        "timeout após commit simulado; sem corte real de rede",
        "riscos herdados de sessão/revogação e controle do host",
        "segundo computador físico não ensaiado",
        "permissões e decisões empresariais futuras antes de operação real"],
    "remote_not_touched": True, "published": False, "point_core_files_verified_unchanged": point_paths,
    "approved_3e_pdfs_verified_unchanged": pdf_paths, "limits": limits,
    "delta_from_3f": delta, "delta_count": len(delta), "removed_from_3f": removed,
    "inventory_count": len(inventory), "files": inventory, "zip_entries": len(inventory) + 1,
    "secret_scan_receipt": TARGET.name + ".verificacao.json",
    "approval_condition": "scan direto passed=true, zero achados, SHA-256 exato do ZIP",
}
payload["MANIFESTO_SHA256.json"] = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")

with zipfile.ZipFile(TARGET, "x", zipfile.ZIP_DEFLATED) as archive:
    for name, raw in sorted(payload.items()):
        archive.writestr(name, raw)

# Exame independente do objeto gravado: reabre o ZIP, valida todas as entradas
# e lê os PDFs em bytes/texto/metadados. Alertas herdados só passam se o hash
# do arquivo e o trecho triado forem exatamente os da baseline 3F aprovada.
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
receipt = {"at": datetime.now(timezone.utc).isoformat(), "id": ID,
    "scope": "scan direto de todas as entradas do ZIP final 3G, PDFs em bytes/texto/metadados",
    "zip": {"path": TARGET.relative_to(ROOT).as_posix(), "sha256": zip_sha,
            "bytes": TARGET.stat().st_size, "entries": len(names), "manifest_files_verified": len(inventory)},
    "delta_from_3f": {"new": sum(x["kind"] == "novo" for x in delta),
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
                  "delta": receipt["delta_from_3f"], "zero_confirmed_secrets": True,
                  "prior_baselines_preserved": preserved}, ensure_ascii=False))
