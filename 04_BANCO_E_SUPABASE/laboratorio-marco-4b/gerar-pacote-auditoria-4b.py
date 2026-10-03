"""Pacote seletivo 4B + carga; reutiliza o scanner direto do ZIP do 4A.
Não cria baseline, não acessa remoto e não inclui backups ou credenciais.
"""
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
import hashlib, json, re, subprocess, sys, zipfile
ROOT = Path(__file__).resolve().parents[2]
LAB = Path(__file__).resolve().parent
ORIGIN = ROOT / "outputs/Metallo-Marco4A-BaselineAprovada-20261001-R1.zip"
ORIGIN_SHA = "50a9c1c87f362f621d6fbe66f3a95a563b787a6145e5fcc918840a162177909d"
sha = lambda raw: hashlib.sha256(raw).hexdigest()
encoded = lambda v: (json.dumps(v, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
assert len(sys.argv)==2 and sys.argv[1] in {"1","2","scan1","scan2","1f","scan1f"}
ARG=sys.argv[1]; CYCLE=ARG.replace('scan','')[0]
REVISION='-Final' if ARG.endswith('f') else ''
TARGET=ROOT/f"outputs/Metallo-Marco4B-RegistrosComprovantes-Auditoria-20261001-Ciclo{CYCLE}{REVISION}.zip"
assert sha(ORIGIN.read_bytes())==ORIGIN_SHA
assert not (ROOT/"04_BANCO_E_SUPABASE/laboratorio-marco-1a/supabase/.temp/project-ref").exists()
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
    nested_sample_entries = 0
    with zipfile.ZipFile(TARGET) as archive:
        assert archive.testzip() is None
        names = archive.namelist()
        manifest = json.loads(archive.read("MANIFESTO_SHA256.json"))
        assert manifest["id"] == f"METALLO-4B-AUDITORIA-CICLO{CYCLE}"
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
                or name.lower().endswith((".pem", ".pfx", ".p12", ".key", ".db", ".sqlite", ".dump", ".bak", ".pgdump", ".map"))
                or name.lower().endswith('.zip') and not name.endswith('/carga-amostra-u0.zip')):
                findings.append({"path": name, "kind": "arquivo/caminho indevido"})
            content = archive.read(entry).decode("utf-8-sig", errors="ignore")
            if any(secret in content for secret in secrets):
                findings.append({"path": name, "kind": "credencial conhecida; valor omitido"})
            for kind, pattern in patterns:
                for match in re.finditer(pattern, content, re.I):
                    findings.append({"path": name, "kind": kind, "match_sha256": sha(match.group().encode())})
            if name.endswith('/carga-amostra-u0.zip'):
                from io import BytesIO
                with zipfile.ZipFile(BytesIO(archive.read(entry))) as sample:
                    assert sample.testzip() is None
                    assert len(sample.namelist()) == len(set(sample.namelist()))
                    for member in sample.infolist():
                        nested_sample_entries += 1
                        assert re.fullmatch(r'recibo-laboratorio-[a-f0-9-]{36}\.pdf', member.filename)
                        child = sample.read(member).decode('utf-8', errors='ignore')
                        if any(secret in child for secret in secrets):
                            findings.append({'path': name+'!'+member.filename, 'kind': 'credencial conhecida; valor omitido'})
                        for kind, pattern in patterns:
                            for match in re.finditer(pattern, child, re.I):
                                findings.append({'path': name+'!'+member.filename, 'kind': kind, 'match_sha256': sha(match.group().encode())})
    receipt = {"at": datetime.now(timezone.utc).isoformat(), "scope": "scan DIRETO de todas as entradas do ZIP final 4B",
        "zip": {"path": TARGET.relative_to(ROOT).as_posix(), "sha256": sha(TARGET.read_bytes()), "entries": len(names)},
        "manifest_and_entry_hashes_verified": True, "known_credentials_compared_only_in_memory": len(secrets), "nested_sample_entries_scanned": nested_sample_entries,
        "findings": findings, "passed": not findings, "is_approved_baseline": False}
    receipt_path.write_bytes(encoded(receipt))
    if not findings:
        Path(str(TARGET) + ".sha256").write_text(f"{receipt['zip']['sha256']}  {TARGET.name}\n", encoding="ascii")
    print(json.dumps(receipt, ensure_ascii=False))
    raise SystemExit(0 if not findings else 1)


if ARG.startswith("scan"):
    scan()

assert not TARGET.exists(), "Não sobrescrever pacote existente"
load=json.loads((LAB/"carga-resultado.json").read_text(encoding="utf-8"))
validation=json.loads((LAB/"carga-validacao-arquivos.json").read_text(encoding="utf-8"))
with zipfile.ZipFile(ORIGIN) as z:
    origin_raw=z.read("MANIFESTO_SHA256.json")
    origin=json.loads(origin_raw)
    origin_hashes={r["path"]:r["sha256"] for r in origin["files"]}
with zipfile.ZipFile(ROOT/"outputs/Metallo-Marco4A-MeuPonto-Auditoria-20261001-Ciclo2.zip") as z:
    previous=json.loads(z.read("MANIFESTO_SHA256.json"))
    paths={r["path"] for r in previous["files"] if r["path"].startswith(("01_WEB/","04_BANCO_E_SUPABASE/","05_DOCUMENTACAO/")) and (ROOT/r["path"]).is_file()}
paths.add("AGENTS.md")
for folder in [ROOT/"01_WEB/app/colaborador/[[...screen]]",ROOT/"04_BANCO_E_SUPABASE/laboratorio-marco-4b"]:
    for p in folder.iterdir():
        if p.is_file() and (p.suffix in {".ts",".tsx",".css",".mjs",".py",".json",".jsonl",".log",".md"} or p.name in {'carga-amostra-u0.pdf','carga-amostra-u0.zip'}):
            if p.name.startswith(("parecer-grok-ciclo2","grok-ciclo2")) or p.name=="carga-processo-web.json":continue
            if p.name.startswith("parecer-") and CYCLE=="1":continue
            paths.add(p.relative_to(ROOT).as_posix())
for p in (ROOT/"01_WEB/10_TESTES").glob("*4b*"):
    paths.add(p.relative_to(ROOT).as_posix())
for name in ["01_WEB/05_ACESSO_A_DADOS/Ponto/registros.ts","01_WEB/03_FUNCOES_E_LOGICA/Relatorios/ponto-recibo-4b.ts",
    "01_WEB/app/api/ponto-registros/[...path]/route.ts","05_DOCUMENTACAO/48_MARCO_4B_MEUS_REGISTROS_E_COMPROVANTES.md",
    "01_WEB/02_COMPONENTES_VISUAIS/brand.tsx","01_WEB/07_ESTILOS/globals.css",
    "01_WEB/03_FUNCOES_E_LOGICA/ItensPessoais/contrato-3g.ts","01_WEB/03_FUNCOES_E_LOGICA/Comunicados/contrato-3h.ts",
    "01_WEB/05_ACESSO_A_DADOS/Supabase/itens-pessoais-3g.ts","01_WEB/05_ACESSO_A_DADOS/Supabase/comunicados-3h.ts",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3d/contrato-entrega-confirmacao.sql",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3g/contrato-itens-pessoais.sql",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3h/contrato-comunicados.sql",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3h/catalogo-local-ciclo2.json"]:
    paths.add(name)
payload={name:(ROOT/name).read_bytes() for name in sorted(paths)}
payload["BASELINE_4A_MANIFESTO.json"]=origin_raw
payload["PROMPT_AUDITORIA_SOMENTE_LEITURA.md"]=(LAB/"prompt-grok.md").read_text(encoding="utf-8").replace("{CYCLE}",CYCLE).encode("utf-8")
payload["LEIA-ME.md"]=("# Marco 4B — revisão adversarial passiva\n\nSIMULAÇÃO SEM VALOR OFICIAL. "
    "Pacote seletivo sanitizado, não é baseline nem checkout executável. "
    "Dados/evidências somente sintéticos. Leia o resultado de carga e falhas preservadas; "
    "não confunda a execução anterior malsucedida com aprovação. "
    "Máximo dois ciclos. Sem remoto, publicação, produção, REP-P ou 4C.\n").encode()
web=json.loads((LAB/"web-auditoria-final-4b.json").read_text(encoding="utf-8"))
payload["RESULTADOS_4B.json"]=encoded({"4B_real_preservado":"51/51","4A_preservado":"80/80","4A_segurança_preservado":"13/13","2F_preservado":"28/28",
    "banco_preservado":"31/31","qualidade_preservado":"44/44","rede_preservado":"8/8","web_rodada":f"{web['numPassedTests']}/{web['numTotalTests']}",
    "carga_passed":load["passed"],"arquivos_carga_passed":validation["passed"],"metrics":load["metrics"],"integrity":load.get("integrity"),
    "approval":"APROVADA visual/manual pelo responsável em 01/10/2026","baseline_created":False,"overlapping_suites_do_not_sum":True})
payload["INVENTARIO_4B.json"]=encoded([{"path":n,"purpose":"fonte/contrato/teste/evidência sintética pertinente ao escopo 4B/carga ou dependência de segurança"} for n in sorted(payload)])
files=[{"path":n,"bytes":len(raw),"sha256":sha(raw)} for n,raw in sorted(payload.items())]
payload["MANIFESTO_SHA256.json"]=encoded({"id":f"METALLO-4B-AUDITORIA-CICLO{CYCLE}","at":datetime.now(timezone.utc).isoformat(),"is_approved_baseline":False,
    "origin":{"id":"METALLO-4A-LAB-20261001-R1","sha256":ORIGIN_SHA},"files":files,"zip_entries":len(files)+1,
    "delta_from_4a":[{"path":n,"origin_sha256":origin_hashes.get(n),"current_sha256":sha(raw)} for n,raw in sorted(payload.items()) if origin_hashes.get(n)!=sha(raw)],
    "limits":["SIMULAÇÃO SEM VALOR OFICIAL","sem baseline 4B","sem 4C","remoto intocado","auditor somente leitura"]})
with zipfile.ZipFile(TARGET,"x",zipfile.ZIP_DEFLATED) as z:
    for name,raw in sorted(payload.items()):z.writestr(name,raw)
print(json.dumps({"zip":str(TARGET),"sha256":sha(TARGET.read_bytes()),"entries":len(payload),"baseline_created":False}))
