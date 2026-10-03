"""Pacote seletivo 4A, catálogo estrutural local e scan DIRETO do ZIP.

Somente auditoria; não cria baseline, não executa projeto nem usa o remoto.
"""
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
import hashlib
import json
import re
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[2]
LAB = ROOT / "04_BANCO_E_SUPABASE/laboratorio-marco-4a"
ORIGIN = ROOT / "outputs/Metallo-Marco3H-BaselineAprovada-20261001-R1.zip"
ORIGIN_SHA = "389137f649221344292ee85d5602f3fbc0c746ce68b4107ee2b607c8b3f084bd"
sha = lambda raw: hashlib.sha256(raw).hexdigest()
encoded = lambda v: (json.dumps(v, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
assert len(sys.argv) == 2 and sys.argv[1] in {"catalog", "1", "2", "scan1", "scan2"}
ARG = sys.argv[1]
assert sha(ORIGIN.read_bytes()) == ORIGIN_SHA
assert not (ROOT / "04_BANCO_E_SUPABASE/laboratorio-marco-1a/supabase/.temp/project-ref").exists()

if ARG == "catalog":
    docker = "C:/Program Files/Docker/Docker/resources/bin/docker.exe"
    endpoint = subprocess.check_output([docker, "context", "inspect", "--format", "{{.Endpoints.docker.Host}}"], text=True).strip()
    assert endpoint.startswith("npipe:////./pipe/"), "Docker não local"
    query = """select jsonb_build_object(
      'at',clock_timestamp(),'scope','somente estrutura local; zero linhas de pessoas/sessoes/credenciais',
      'functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
        'owner',pg_get_userbyid(p.proowner),'security_definer',p.prosecdef,'settings',p.proconfig,
        'acl',p.proacl,'definition',pg_get_functiondef(p.oid)) order by p.proname)
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
        and p.proname in ('my_employee_profile','is_active_admin','lab_active_session_2e','lab_authz_source_2f','lab_sessions_before_cutoff_2f')),
      'tables',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,
        'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'acl',c.relacl,
        'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull)
          order by a.attnum) from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
        'constraints',(select jsonb_agg(pg_get_constraintdef(k.oid)) from pg_constraint k where k.conrelid=c.oid),
        'triggers',(select jsonb_agg(pg_get_triggerdef(t.oid)) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal),
        'policies',(select jsonb_agg(to_jsonb(q)) from pg_policies q where q.schemaname=n.nspname and q.tablename=c.relname)) order by n.nspname,c.relname)
        from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.oid in
        ('private.employee_identity'::regclass,'private.employee_identity_audit'::regclass,'private.employee_portal_accounts'::regclass,
         'public.epi_employees'::regclass,'public.profiles'::regclass,'public.teams'::regclass,'auth.sessions'::regclass)),
      'schema_acl',(select jsonb_object_agg(nspname,nspacl) from pg_namespace where nspname in ('private','auth')))
    """
    raw = subprocess.check_output([docker, "exec", "supabase_db_laboratorio-marco-1a", "psql", "-X", "-q", "-A", "-t", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", query], text=True, encoding="utf-8")
    catalog = json.loads(raw)
    assert len(catalog["functions"]) == 5
    (LAB / "catalogo-autorizacao-local.json").write_bytes(encoded(catalog))
    print(json.dumps({"functions": 5, "tables": len(catalog["tables"]), "user_rows_exported": 0}))
    sys.exit(0)

CYCLE = ARG[-1]
TARGET = ROOT / f"outputs/Metallo-Marco4A-MeuPonto-Auditoria-20261001-Ciclo{CYCLE}.zip"


def scan():
    receipt_path = Path(str(TARGET) + ".verificacao.json")
    assert TARGET.is_file() and not receipt_path.exists(), "ZIP ausente ou recibo já existente"
    secrets = set()

    def walk(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if isinstance(child, str) and re.search(r"password|senha|token|secret|key", key, re.I) and len(child) >= 12:
                    secrets.add(child)
                else:
                    walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)

    for path in (ROOT / "backups").glob("credenciais-previa*.json"):
        walk(json.loads(path.read_text(encoding="utf-8-sig")))
    for path in (ROOT / "01_WEB").glob(".env*"):
        if path.is_file():
            for line in path.read_text(encoding="utf-8-sig", errors="ignore").splitlines():
                m = re.match(r"\s*(?:export\s+)?([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|KEY)[A-Z0-9_]*)\s*=\s*(.+?)\s*$", line, re.I)
                if m and len(m[2].strip("\"'")) >= 12:
                    secrets.add(m[2].strip("\"'"))
    status = json.loads(subprocess.check_output(["C:/Program Files/nodejs/node.exe", str(ROOT / "node_modules/supabase/dist/supabase.js"), "status", "--workdir", str(ROOT / "04_BANCO_E_SUPABASE/laboratorio-marco-1a"), "-o", "json"], text=True, encoding="utf-8", stderr=subprocess.DEVNULL))
    assert status["API_URL"] == "http://127.0.0.1:54321"
    for key in ("SERVICE_ROLE_KEY", "JWT_SECRET", "ANON_KEY", "SECRET_KEY"):
        if isinstance(status.get(key), str) and len(status[key]) >= 12:
            secrets.add(status[key])
    patterns = (
        ("JWT literal", r"eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{12,}"),
        ("sb_secret", r"sb_secret_[A-Za-z0-9_-]{16,}"),
        ("private PEM", r"-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----"),
        ("cookie literal", r"(?<![A-Za-z0-9_])(?:Set-Cookie:|Cookie:)\s+[^\\\r\n]{20,}"),
        ("token literal", r"(?:refresh_token|refreshToken|access_token|accessToken)\s*[=:]\s*[\"'][A-Za-z0-9._-]{24,}[\"']"),
        ("service_role literal", r"(?:SERVICE_ROLE_KEY|service_role_key)\s*[=:]\s*[\"'][A-Za-z0-9._-]{24,}[\"']"),
        ("senha literal", r"(?:password|senha)\s*[=:]\s*[\"'][^\"'\r\n]{12,}[\"']"),
        ("private JWK", r"[\"']d[\"']\s*:\s*[\"'][A-Za-z0-9_-]{32,}[\"']"),
    )
    findings = []
    with zipfile.ZipFile(TARGET) as archive:
        assert archive.testzip() is None
        names = archive.namelist()
        manifest = json.loads(archive.read("MANIFESTO_SHA256.json"))
        assert manifest["id"] == f"METALLO-4A-AUDITORIA-CICLO{CYCLE}"
        assert len(names) == len(set(names)) == manifest["zip_entries"]
        assert set(names) == {row["path"] for row in manifest["files"]} | {"MANIFESTO_SHA256.json"}
        for row in manifest["files"]:
            raw = archive.read(row["path"])
            assert sha(raw) == row["sha256"] and len(raw) == row["bytes"]
        for entry in archive.infolist():
            name = entry.filename
            parts = PurePosixPath(name).parts
            if (entry.is_dir() or name.startswith("/") or ".." in parts or ":" in name or "\\" in name
                or any(p.lower() in {"backups", "node_modules", ".git", ".temp", "cookies", "credentials", "credenciais", "storage", "localstorage", "sessionstorage"} or p.lower().startswith((".env", ".next", "credenciais-previa")) for p in parts)
                or name.lower().endswith((".pem", ".pfx", ".p12", ".key", ".db", ".sqlite", ".dump", ".bak", ".pgdump", ".zip", ".map"))):
                findings.append({"path": name, "kind": "arquivo/caminho indevido"})
            content = archive.read(entry).decode("utf-8-sig", errors="strict")
            if any(secret in content for secret in secrets):
                findings.append({"path": name, "kind": "credencial conhecida; valor omitido"})
            for kind, pattern in patterns:
                for match in re.finditer(pattern, content, re.I):
                    findings.append({"path": name, "kind": kind, "match_sha256": sha(match.group().encode())})
    receipt = {"at": datetime.now(timezone.utc).isoformat(), "scope": "scan DIRETO de todas as entradas do ZIP final 4A",
        "zip": {"path": TARGET.relative_to(ROOT).as_posix(), "sha256": sha(TARGET.read_bytes()), "entries": len(names)},
        "manifest_and_entry_hashes_verified": True, "known_credentials_compared_only_in_memory": len(secrets),
        "findings": findings, "passed": not findings, "is_approved_baseline": False}
    receipt_path.write_bytes(encoded(receipt))
    if not findings:
        Path(str(TARGET) + ".sha256").write_text(f"{receipt['zip']['sha256']}  {TARGET.name}\n", encoding="ascii")
    print(json.dumps(receipt, ensure_ascii=False))
    raise SystemExit(0 if not findings else 1)


if ARG.startswith("scan"):
    scan()

assert not TARGET.exists(), "Não sobrescrever pacote existente"
proof = json.loads((LAB / "resultado-4a.json").read_text(encoding="utf-8-sig"))
web = json.loads((LAB / "web-completa-4a.json").read_text(encoding="utf-8-sig"))
assert proof["passed"] and all(c["ok"] for c in proof["checks"])
assert web["success"] and web["numTotalTests"] == web["numPassedTests"] and web["numFailedTests"] == 0
with zipfile.ZipFile(ORIGIN) as archive:
    origin_raw = archive.read("MANIFESTO_SHA256.json")
    origin_manifest = json.loads(origin_raw)
    origin_hashes = {row["path"]: row["sha256"] for row in origin_manifest["files"]}

paths = {
    "AGENTS.md", "01_WEB/package.json", "01_WEB/next.config.ts", "01_WEB/proxy.ts",
    "01_WEB/02_COMPONENTES_VISUAIS/sidebar-nav.tsx",
    "01_WEB/03_FUNCOES_E_LOGICA/Autenticacao/session.ts", "01_WEB/03_FUNCOES_E_LOGICA/Autenticacao/use-colaborador-session.ts",
    "01_WEB/03_FUNCOES_E_LOGICA/Ponto/geolocalizacao-evento.ts", "01_WEB/03_FUNCOES_E_LOGICA/Ponto/relogio-referencia.ts",
    "01_WEB/05_ACESSO_A_DADOS/Ponto/ponto-online.ts", "01_WEB/05_ACESSO_A_DADOS/Ponto/ponto-gestao.ts", "01_WEB/05_ACESSO_A_DADOS/Ponto/ponto-lab.ts",
    "01_WEB/05_ACESSO_A_DADOS/Supabase/colaborador-local.ts", "01_WEB/05_ACESSO_A_DADOS/Supabase/server.ts", "01_WEB/05_ACESSO_A_DADOS/Supabase/proxy.ts",
    "01_WEB/09_CONFIGURACOES/colaborador-laboratorio.ts", "01_WEB/09_CONFIGURACOES/ambienteSupabase.ts",
    "01_WEB/app/api/ponto-online/[...path]/route.ts", "01_WEB/app/api/ponto-lab/[...path]/route.ts",
    "01_WEB/app/colaborador/[[...screen]]/colaborador-app.tsx", "01_WEB/app/colaborador/[[...screen]]/colaborador.module.css",
    "01_WEB/app/colaborador/[[...screen]]/page.tsx", "01_WEB/app/colaborador/[[...screen]]/meu-ponto-online.tsx",
    "01_WEB/app/(02_SISTEMA)/ponto-laboratorio/page.tsx", "01_WEB/10_TESTES/ponto-online.test.tsx",
    "01_WEB/10_TESTES/colaborador-seguranca.test.ts", "01_WEB/10_TESTES/colaborador-auth-real.integration.tsx",
    "01_WEB/10_TESTES/colaborador-preview.test.tsx", "05_DOCUMENTACAO/47_MARCO_4A_MEU_PONTO_ONLINE_GEOLOCALIZACAO.md",
    "05_DOCUMENTACAO/38_MARCO_2F_RECONCILIACAO_E_FECHAMENTO_SINTETICO.md",
    "04_BANCO_E_SUPABASE/laboratorio-marco-1a/criar-contas-previa-1b.mjs",
    "04_BANCO_E_SUPABASE/laboratorio-marco-1a/revogar-conta-portal-servidor.mjs",
    "04_BANCO_E_SUPABASE/laboratorio-marco-1a/verificar-rede-local.mjs",
    "04_BANCO_E_SUPABASE/laboratorio-marco-2f/reconciliacao.mjs", "04_BANCO_E_SUPABASE/laboratorio-marco-2f/origem-local-2f.sql",
    "04_BANCO_E_SUPABASE/laboratorio-marco-2f/provas-2f.mjs", "04_BANCO_E_SUPABASE/laboratorio-marco-2f/resultado-2f.json",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260925120000_employee_identity_foundation.sql",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260926213000_portal_profile_optional_team.sql",
}
for name in ("auth-local.mjs", "autorizacao.mjs", "backup.mjs", "http-lab.mjs", "integridade.mjs", "nucleo.mjs", "recuperacao.mjs", "schema.sql", "sessao-local-2e.sql"):
    paths.add("04_BANCO_E_SUPABASE/laboratorio-marco-2b/" + name)
for path in LAB.iterdir():
    if path.suffix in {".mjs", ".sql", ".json", ".log", ".py", ".md"} and not path.name.startswith("parecer-"):
        paths.add(path.relative_to(ROOT).as_posix())
if CYCLE == "2":
    paths.add("04_BANCO_E_SUPABASE/laboratorio-marco-4a/parecer-grok-ciclo1-original.md")
payload = {}
for name in sorted(paths):
    path = ROOT / name
    assert path.is_file(), name
    payload[name] = path.read_bytes()
payload["BASELINE_3H_MANIFESTO.json"] = origin_raw
prompt = (LAB / "prompt-grok.md").read_text(encoding="utf-8").replace("{CYCLE}", CYCLE)
payload["PROMPT_AUDITORIA_SOMENTE_LEITURA.md"] = prompt.encode()
payload["LEIA-ME.md"] = ("# Marco 4A — revisão passiva sanitizada\n\n"
    "SIMULAÇÃO SEM VALOR OFICIAL. Não é baseline, checkout executável, dump ou comprovante oficial. "
    "Somente fontes pertinentes, dependências congeladas de segurança, catálogo estrutural sem linhas, "
    "evidências de testes sintéticos, documento vigente e manifesto da origem. Nenhuma credencial incluída. "
    "Resultados pre-auditoria não equivalem a execução independente do auditor. Máximo dois ciclos. "
    "Remoto intocado; sem produção, funcionários reais, conformidade REP-P, ponto oficial, publicação ou 4B.\n").encode()
payload["RESULTADOS_4A.json"] = encoded({"4a": f"{len(proof['checks'])}/{len(proof['checks'])}",
    "web": f"{web['numPassedTests']}/{web['numTotalTests']}", "specific_web": len(next(t for t in web["testResults"] if "ponto-online.test" in t["name"])["assertionResults"]),
    "2f": "28/28", "bank": "31/31", "quality": "44/44", "network": "8/8", "typescript": "aprovado", "lint": "aprovado", "build": "aprovado",
    "audit_regressions": "13/13" if CYCLE == "2" else "Não executadas antes do ciclo 1",
    "rerun_after_correction": ["4A Auth/JWT/PostgREST/HTTP 80/80", "confronto/sessões 13/13"] if CYCLE == "2" else [],
    "manual_approval": "APROVADA pelo responsável em 01/10/2026", "overlapping_suites_do_not_sum": True})
payload["INVENTARIO_4A.json"] = encoded([{"path": n, "purpose": "fonte/contrato/teste/evidência de segurança ou contexto da origem"} for n in sorted(payload)])
files = [{"path": n, "bytes": len(raw), "sha256": sha(raw)} for n, raw in sorted(payload.items())]
manifest = {"id": f"METALLO-4A-AUDITORIA-CICLO{CYCLE}", "at": datetime.now(timezone.utc).isoformat(),
    "is_approved_baseline": False, "origin": {"id": "METALLO-3H-LAB-20261001-R1", "sha256": ORIGIN_SHA, "origin_zip_included": False},
    "files": files, "inventory_count": len(files), "zip_entries": len(files)+1,
    "delta_from_3h": [{"path": n, "origin_sha256": origin_hashes.get(n), "current_sha256": sha(raw), "status": "DIFFERENT" if n in origin_hashes else "NOT_IN_DIRECT_ORIGIN_INVENTORY"}
        for n, raw in sorted(payload.items()) if not n.startswith("BASELINE_") and origin_hashes.get(n) != sha(raw)],
    "limits": ["SIMULAÇÃO SEM VALOR OFICIAL", "remoto intocado", "sem baseline 4A", "sem 4B", "sem publicação", "somente leitura no auditor"]}
payload["MANIFESTO_SHA256.json"] = encoded(manifest)
with zipfile.ZipFile(TARGET, "x", zipfile.ZIP_DEFLATED) as archive:
    for name, raw in sorted(payload.items()):
        archive.writestr(name, raw)
print(json.dumps({"zip": str(TARGET), "sha256": sha(TARGET.read_bytes()), "files": len(files), "entries": len(payload), "baseline_created": False}))
