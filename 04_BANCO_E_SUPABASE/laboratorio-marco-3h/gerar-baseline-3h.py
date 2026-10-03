"""Verifica e congela somente a baseline 3H autorizada; scan direto do ZIP final.

verify: lê contratos Docker/HTTP/listeners locais, sem SQL de escrita ou testes novos.
Sem argumento: seleciona fontes congeladas/auditadas, gera ZIP e examina suas entradas.
Não executa deploy, migration, Auth, auditoria externa ou conexão remota.
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
import urllib.request
import zipfile
from pypdf import PdfReader

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parents[2]
LAB = ROOT / "04_BANCO_E_SUPABASE/laboratorio-marco-3h"
OUTPUTS = ROOT / "outputs"
ID = "METALLO-3H-LAB-20261001-R1"
PARENT_ID = "METALLO-3G-LAB-20260930-R1"
PARENT_SHA = "36d40d4eb85f594b75f904b899b13c02cd3283efa451bb25cdc4ed3c4b00323f"
PARENT = OUTPUTS / "Metallo-Marco3G-BaselineAprovada-20260930-R1.zip"
TARGET = OUTPUTS / "Metallo-Marco3H-BaselineAprovada-20261001-R1.zip"
DOC = "05_DOCUMENTACAO/46_MARCO_3H_COMUNICADOS.md"
VERIFICATION = LAB / "verificacao-fechamento-3h.json"
AUDITS = {
    1: ("ad1b26e18c8ba5cf4e1a0516cf94510f184164ce89bd43f524213a3a5b22e382", 46, 47,
        "eb4e41b9f040d6a172e22bb376b646637bf885238053b4ddd311796dddb6bc9d"),
    2: ("eb5530dc86382c180129c6dedcaf6607803617cfbb43e162d433205633942d8b", 56, 57,
        "a2ad7e0203b82f3a15ea9ea7da97b11921ce9256701048b2865c0fdfcc0c015e"),
}
CONVERSATION = "https://grok.com/c/fc9db24d-7beb-4955-96d6-0032ed7d169a"

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def read(name):
    return (ROOT / name).read_bytes()

def encoded(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")

# Reutiliza somente helpers já revisados; não executa o gerador antigo.
source = ROOT / "04_BANCO_E_SUPABASE/laboratorio-marco-3d/gerar-baseline-3d.py"
tree = ast.parse(source.read_text(encoding="utf-8-sig"))
nodes = [n for n in tree.body if
    isinstance(n, ast.FunctionDef) and n.name in {"checked_archive", "local_secrets"}
    or isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "PATTERNS" for t in n.targets)]
assert len(nodes) == 3
helpers = {"ROOT": ROOT, "Path": Path, "json": json, "re": re, "zipfile": zipfile, "sha": sha}
exec(compile(ast.Module(body=nodes, type_ignores=[]), str(source), "exec"), helpers)

assert not (ROOT / "04_BANCO_E_SUPABASE/laboratorio-marco-1a/supabase/.temp/project-ref").exists()
assert sha(PARENT.read_bytes()) == PARENT_SHA, "Origem 3G alterada"
parent_manifest, parent = helpers["checked_archive"](PARENT, PARENT_ID)
parent_receipt = json.loads(Path(str(PARENT) + ".verificacao.json").read_text(encoding="utf-8-sig"))
assert parent_manifest["is_approved_baseline"] and parent_receipt["passed"] and not parent_receipt["findings"]
assert parent_receipt["zip"]["sha256"] == PARENT_SHA
parent_hashes = {name: sha(raw) for name, raw in parent.items()}
audits = {}
for cycle, (digest, files, entries, opinion_digest) in AUDITS.items():
    name = f"Metallo-Marco3H-Comunicados-Auditoria-20260930-Ciclo{cycle}.zip"
    path = OUTPUTS / name
    assert sha(path.read_bytes()) == digest
    manifest, contents = helpers["checked_archive"](path, f"METALLO-3H-AUDITORIA-CICLO{cycle}")
    assert manifest["inventory_count"] == files and manifest["zip_entries"] == entries
    receipt = json.loads(Path(str(path) + ".verificacao.json").read_text(encoding="utf-8-sig"))
    assert receipt["passed"] and not receipt["findings"] and receipt["zip"]["sha256"] == digest
    opinion = f"04_BANCO_E_SUPABASE/laboratorio-marco-3h/parecer-grok-ciclo{cycle}-original.md"
    assert sha(read(opinion)) == opinion_digest
    audits[str(cycle)] = {"zip": name, "sha256": digest, "files": files, "entries": entries,
        "direct_scan_passed": True, "opinion": opinion, "opinion_sha256": opinion_digest,
        "conversation": CONVERSATION}
    if cycle == 2:
        audited = contents

proof = json.loads((LAB / "resultado-3h.json").read_text(encoding="utf-8-sig"))
web = json.loads((LAB / "web-completa-3h.json").read_text(encoding="utf-8-sig"))
assert proof["failed"] == 0 and proof["passed"] == len(proof["checks"]) == 70 and all(c["ok"] for c in proof["checks"])
assert web["success"] and web["numPassedTests"] == web["numTotalTests"] == 223 and web["numFailedTests"] == 0
assert len(web["testResults"]) == 33
after_audit = {DOC}
selected = {name for name in audited if name.startswith(("01_WEB/", "03_COMPARTILHADO/", "04_BANCO_E_SUPABASE/", "05_DOCUMENTACAO/")) or name == "AGENTS.md"}
for name in selected:
    assert (ROOT / name).is_file(), name
    assert name in after_audit or sha(read(name)) == sha(audited[name]), f"Fonte mudou após auditoria: {name}"
old_test = "01_WEB/10_TESTES/colaborador-perfil-equipe.test.tsx"
assert sha(read(old_test)) == parent_hashes[old_test], "Teste F14 alterado"

if len(sys.argv) == 2 and sys.argv[1] == "verify":
    docker = "C:/Program Files/Docker/Docker/resources/bin/docker.exe"
    endpoint = subprocess.check_output([docker, "context", "inspect", "--format", "{{.Endpoints.docker.Host}}"], text=True).strip()
    assert endpoint.startswith("npipe:////./pipe/"), "Docker deve ser local"
    catalog = json.loads((LAB / "catalogo-local-ciclo2.json").read_text(encoding="utf-8-sig"))
    literal = lambda value: "'" + value.replace("'", "''") + "'"
    ids = ",".join(literal(f["signature"]) + "::regprocedure" for f in catalog["functions"])
    query = f"""select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),
      'security_definer',p.prosecdef,'settings',p.proconfig,'acl',p.proacl,'definition',pg_get_functiondef(p.oid)))
      from pg_proc p where p.oid in ({ids})"""
    def query_json(sql):
        return json.loads(subprocess.check_output([docker, "exec", "supabase_db_laboratorio-marco-1a", "psql", "-X", "-q", "-A", "-t", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", sql], text=True, encoding="utf-8"))
    functions = {f["signature"]: f for f in query_json(query)}
    assert len(functions) == 12 and all(functions[f["signature"]] == f for f in catalog["functions"]), "Catálogo funcional mudou"
    table_names = ("communications_3h", "communication_revisions_3h", "communication_views_3h")
    tables = query_json("""select jsonb_agg(jsonb_build_object('table',c.relname,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
      'owner',pg_get_userbyid(c.relowner),'acl',c.relacl,'policies',(select count(*) from pg_policy p where p.polrelid=c.oid)))
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private'
      and c.relname in ('communications_3h','communication_revisions_3h','communication_views_3h')""")
    assert len(tables) == 3
    for table in tables:
        frozen = next(t for t in catalog["tables"] if t["schema"] == "private" and t["table"] == table["table"])
        assert table["table"] in table_names and table["rls"] and table["policies"] == 0
        assert all(table[key] == frozen[key] for key in ("rls", "force_rls", "owner", "acl")), "ACL/RLS mudou"
    powershell = "Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 3101,3102,54321,54322 } | Select-Object LocalAddress,LocalPort | ConvertTo-Json"
    listeners = json.loads(subprocess.check_output(["powershell", "-NoProfile", "-Command", powershell], text=True, encoding="utf-8"))
    assert {v["LocalPort"] for v in listeners} == {3101, 3102, 54321, 54322}
    assert all(v["LocalAddress"] in {"127.0.0.1", "::1"} for v in listeners)
    class LoopbackRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            assert newurl.startswith(("http://127.0.0.1:3101/", "http://127.0.0.1:3102/")), "Redirect externo proibido"
            return super().redirect_request(req, fp, code, msg, headers, newurl)
    http = []
    opener = urllib.request.build_opener(LoopbackRedirect())
    for url in ("http://127.0.0.1:3101/colaborador/comunicados", "http://127.0.0.1:3102/comunicados"):
        with opener.open(url, timeout=15) as response:
            assert response.status == 200
            http.append({"url": url, "status": response.status, "final_url": response.geturl(), "authentication_not_retested": True})
    verification = {"at": datetime.now(timezone.utc).isoformat(), "id": ID, "passed": True,
        "scope": "conferência rápida local; SQL somente leitura, sem Auth/deploy/migration/Grok",
        "functions_identical_to_audited_catalog": 12, "private_tables_rls_acl_identical": tables,
        "audited_sources_identical_except_updated_document": True, "old_f14_test_identical_to_3g": parent_hashes[old_test],
        "listeners": listeners, "http": http, "audited_results_preserved": {"real_auth_rpc": "70/70", "web": "223/223"},
        "quick_web_tests": {"result": "37/37", "source": "exec_command desta rodada; três arquivos existentes, exit 0, sem alterar assertions"},
        "remote_not_touched": True, "published": False}
    VERIFICATION.write_bytes(encoded(verification))
    print(json.dumps({"passed": True, "functions": 12, "private_tables": 3, "listeners_loopback": True, "http": http}, ensure_ascii=False))
    sys.exit(0)
assert len(sys.argv) == 1, "Use verify ou sem argumento"

for path in (TARGET, Path(str(TARGET) + ".sha256"), Path(str(TARGET) + ".verificacao.json")):
    assert not path.exists(), f"Não sobrescrever: {path.name}"
verification = json.loads(VERIFICATION.read_text(encoding="utf-8-sig"))
assert verification["passed"] and verification["id"] == ID
previous = {p.name: sha(p.read_bytes()) for p in OUTPUTS.glob("Metallo-*-Baseline*.zip")}
doc = read(DOC).decode("utf-8-sig")
for required in (ID, "FUNCIONAL EM LABORATÓRIO", "70/70", "223/223", "37/37", "F-3H-14", "SIMULAÇÃO SEM VALOR OFICIAL", "APROVADA"):
    assert required in doc, required
payload = dict(parent)
for name in selected:
    payload[name] = read(name)
additional = [DOC, "05_DOCUMENTACAO/MAPA_DO_METALLO.md",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3h/parecer-grok-ciclo2-original.md",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3h/gerar-baseline-3h.py",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3h/verificacao-fechamento-3h.json",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3h/preparar-previa-3h.mjs"]
for name in additional:
    payload[name] = read(name)
for cycle in AUDITS:
    prefix = f"outputs/Metallo-Marco3H-Comunicados-Auditoria-20260930-Ciclo{cycle}.zip"
    for suffix in (".verificacao.json", ".sha256"):
        payload[prefix + suffix] = read(prefix + suffix)
for path in LAB.glob("grok-*.jpg"):
    payload[path.relative_to(ROOT).as_posix()] = path.read_bytes()
payload["BASELINE_3G_MANIFESTO.json"] = encoded(parent_manifest)
point_paths = [name for name in parent if name.startswith("04_BANCO_E_SUPABASE/laboratorio-marco-2f/") and name.endswith((".mjs", ".sql"))]
pdf_paths = [name for name in parent if name.endswith(".pdf")]
for name in point_paths + pdf_paths:
    assert sha(payload[name]) == parent_hashes[name] == sha(read(name)), f"Fonte anterior protegida alterada: {name}"
limits = ["SIMULAÇÃO SEM VALOR OFICIAL", "SUPABASE REMOTO INTOCADO", "NÃO IMPLANTADO NO SUPABASE REMOTO",
    "NÃO LIBERADO PARA FUNCIONÁRIOS REAIS", "NÃO É PRODUÇÃO", "NÃO É CONFORMIDADE REP-P",
    "NÃO É AUTORIZAÇÃO DE PONTO OFICIAL", "NÃO AUTORIZA PUBLICAÇÃO", "SEM TERCEIRO CICLO GROK", "SEM MARCO 3I"]
payload["LEIA-ME.md"] = (f"# {ID}\n\nMARCO 3H — COMUNICADOS — FUNCIONAL EM LABORATÓRIO. "
    f"Fechamento e baseline autorizados pelo responsável em 01/10/2026. Origem imutável {PARENT_ID}, SHA-256 {PARENT_SHA}. "
    f"Consulte {DOC}. Fotografia selecionada de fontes/evidências, herdada da 3G e acrescida do 3H, "
    "não é checkout executável nem backup de banco. Pareceres e confronto F01–F14 preservados. "
    "PDFs/passkey/Storage de marcos anteriores são contexto herdado; não foram integrados a Comunicados. "
    "Listar não é visualizar; abrir não é assinatura/concordância/aceite/ciência trabalhista formal. "
    "O SHA do ZIP e o scan direto são recibos externos para evitar autorreferência. "
    "Baseline válida apenas com passed=true, zero segredos confirmados e hash exato no recibo.\n\n"
    + "; ".join(limits) + ".\n").encode("utf-8")
payload["INVENTARIO_3H.json"] = encoded([{"path": name, "bytes": len(raw), "sha256": sha(raw),
    "origin": "3g_preservado" if parent_hashes.get(name) == sha(raw) else "3h_selecionado"} for name, raw in sorted(payload.items())])
delta = [{"path": name, "kind": "alterado" if name in parent else "novo", "sha256_3g": parent_hashes.get(name), "sha256_3h": sha(raw)}
    for name, raw in sorted(payload.items()) if parent_hashes.get(name) != sha(raw)]
removed = sorted(set(parent) - set(payload))
assert not removed
inventory = [{"path": name, "bytes": len(raw), "sha256": sha(raw)} for name, raw in sorted(payload.items())]
manifest = {"id": ID, "at": datetime.now(timezone.utc).isoformat(), "is_approved_baseline": True,
    "status": "MARCO 3H — COMUNICADOS — FUNCIONAL EM LABORATÓRIO", "document": DOC,
    "parent": {"id": PARENT_ID, "zip": PARENT.name, "sha256": PARENT_SHA, "immutable": True},
    "formal_approval": {"by": "responsável", "date": "2026-10-01", "explicitly_authorized": ID, "manual_preview": "APROVADA", "local_only": True},
    "results": {"Auth_JWT_PostgREST_RPC": "70/70", "web_complete": "223/223", "affected_included_in_web": "37/37",
        "TypeScript": "aprovado", "lint": "aprovado", "build": "aprovado", "overlapping_suites_do_not_sum": True,
        "quick_verification": VERIFICATION.relative_to(ROOT).as_posix()},
    "audits": {"cycles": 2, "cycle1": audits["1"], "cycle2": audits["2"], "findings_confronted": 14,
        "critical_confirmed_open": 0, "high_confirmed_open": 0, "confrontation": DOC, "passive_only": True, "third_cycle": False,
        "code_changed_after_cycle2": False, "post_audit_document_updated": DOC, "closure_evidence_added": additional},
    "classifications": {"F01": "VALID/corrigido", "F02": "VALID/corrigido", "F03": "VALID/corrigido na mesma intenção",
        "F04": "VALID/corrigido", "F05": "VALID/risco de produto", "F06": "PARTIAL/residual", "F07": "VALID/tetos",
        "F08": "NOT VERIFIABLE", "F09": "PARTIAL/mandato passivo", "F10": "VALID/sanado", "F11": "PARTIAL/hipótese temporal",
        "F12": "INVALID/contexto sanado", "F13": "VALID/limite semântico", "F14": "PARTIAL/limite de ensaio"},
    "residual_risks": ["F05: revisão não reinicia não lido", "F06: janela de contexto/abertura/arquivo",
        "F08: viewport/teclado não verificáveis independentemente pelo Grok", "F11: now()/clock_timestamp()",
        "F14: timeout Web intermediário 222/223; teste idêntico à 3G, 9/9 isolado, final 223/223",
        "F07: contador 20+ e até 1000 alvos", "F09: auditor não executou gates", "F13: visualização não é ciência trabalhista",
        "retry com resposta perdida simulado por mock; sem corte real de rede", "sem uso/funcionário real ou estoque físico",
        "riscos herdados de sessão/revogação/administrador do host; segundo computador físico não ensaiado"],
    "audience": "contexto atual no servidor; ALL inclui ativo sem equipe/obra; TEAM/WORK não confiam no cliente",
    "view_semantics": "listar != abrir; primeira abertura idempotente por pessoa; não é assinatura/concordância/aceite/ciência formal",
    "remote_not_touched": True, "published": False, "limits": limits,
    "point_2f_verified_unchanged": point_paths, "inherited_pdfs_verified_unchanged": pdf_paths,
    "delta_from_3g": delta, "delta_count": len(delta), "removed_from_3g": removed,
    "inventory_count": len(inventory), "files": inventory, "zip_entries": len(inventory) + 1,
    "secret_scan_receipt": TARGET.name + ".verificacao.json", "approval_condition": "scan direto passed=true, zero achados, SHA exato"}
payload["MANIFESTO_SHA256.json"] = encoded(manifest)
with zipfile.ZipFile(TARGET, "x", zipfile.ZIP_DEFLATED) as archive:
    for name, raw in sorted(payload.items()):
        archive.writestr(name, raw)

# Reabre e examina o objeto final; não apenas os arquivos usados na geração.
patterns = tuple(helpers["PATTERNS"]) + (
    ("access token literal", r"(?:access_token|accessToken)\s*[=:]\s*[\"'][A-Za-z0-9._-]{24,}[\"']"),
    ("WebAuthn private key JWK", r"[\"']d[\"']\s*:\s*[\"'][A-Za-z0-9_-]{32,}[\"']"),)
known = helpers["local_secrets"]()
for path in (ROOT / "01_WEB").glob(".env*"):
    if path.is_file():
        for line in path.read_text(encoding="utf-8-sig", errors="ignore").splitlines():
            match = re.match(r"\s*(?:export\s+)?([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|KEY)[A-Z0-9_]*)\s*=\s*(.+?)\s*$", line, re.I)
            if match and len(match.group(2).strip("\"'")) >= 12:
                known.add(match.group(2).strip("\"'"))
accepted = {(row["path"], row["kind"], item["match_sha256"]): item for row in parent_receipt.get("triage", [])
    for item in row["matches"] if item.get("classification") == "NOT_SECRET"}
findings, alerts, triage, pdfs = [], [], [], []
with zipfile.ZipFile(TARGET) as archive:
    assert archive.testzip() is None
    names = archive.namelist()
    assert len(names) == len(set(names)) == manifest["zip_entries"]
    assert set(names) == {r["path"] for r in inventory} | {"MANIFESTO_SHA256.json"}
    for row in inventory:
        raw = archive.read(row["path"])
        assert len(raw) == row["bytes"] and sha(raw) == row["sha256"], row["path"]
    for entry in archive.infolist():
        name = entry.filename
        parts = PurePosixPath(name).parts
        if (entry.is_dir() or stat.S_ISLNK(entry.external_attr >> 16) or not parts or name.startswith("/") or ".." in parts or ":" in name or "\\" in name
            or any(p.lower() in {"backups", "node_modules", ".git", ".temp", ".next", "cookies", "credentials", "credenciais", "storage", "localstorage", "sessionstorage"}
                or p.lower().startswith((".env", ".next", "credenciais-previa", "credenciais-preview")) for p in parts)
            or name.lower().endswith((".pem", ".pfx", ".p12", ".key", ".db", ".sqlite", ".dump", ".bak", ".pgdump", ".zip", ".map"))):
            findings.append({"path": name, "kind": "arquivo/caminho indevido"})
        raw = archive.read(entry)
        content = raw.decode("utf-8-sig", errors="ignore")
        if name.lower().endswith(".pdf"):
            reader = PdfReader(BytesIO(raw))
            content += "\n" + "\n".join(page.extract_text() or "" for page in reader.pages) + "\n" + str(reader.metadata)
            pdfs.append({"path": name, "pages": len(reader.pages), "sha256": sha(raw), "bytes_text_metadata_scanned": True})
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
            findings.append({"path": name, "kind": "credencial conhecida; valor omitido"})
zip_sha = sha(TARGET.read_bytes())
assert all(sha((OUTPUTS / name).read_bytes()) == digest for name, digest in previous.items()), "Baseline anterior alterada"
receipt = {"at": datetime.now(timezone.utc).isoformat(), "id": ID, "scope": "scan DIRETO de todas as entradas do ZIP final 3H; PDFs herdados bytes/texto/metadados",
    "zip": {"path": TARGET.relative_to(ROOT).as_posix(), "sha256": zip_sha, "bytes": TARGET.stat().st_size, "entries": len(names), "manifest_files_verified": len(inventory)},
    "delta_from_3g": {"new": sum(r["kind"] == "novo" for r in delta), "changed": sum(r["kind"] == "alterado" for r in delta), "removed": len(removed)},
    "known_local_credentials_checked_in_memory": len(known), "patterns_checked": [k for k, _ in patterns], "initial_raw_alerts": alerts,
    "triage": triage, "values_redacted": True, "pdfs": pdfs, "findings": findings, "passed": not findings, "is_approved_baseline": not findings,
    "previous_baselines_preserved": previous, "audit_cycles_preserved": True, "remote_not_touched": True, "published": False}
Path(str(TARGET) + ".verificacao.json").write_bytes(encoded(receipt))
if findings:
    print(json.dumps({"passed": False, "findings": findings}, ensure_ascii=False))
    sys.exit(1)
Path(str(TARGET) + ".sha256").write_text(f"{zip_sha}  {TARGET.name}\n", encoding="ascii")
TARGET.chmod(0o444)
print(json.dumps({"passed": True, "id": ID, "zip": str(TARGET), "sha256": zip_sha, "files": len(inventory), "entries": len(names),
    "delta": receipt["delta_from_3g"], "confirmed_secrets": 0, "previous_baselines_preserved": len(previous)}, ensure_ascii=False))
