"""Conferência local do 4A: origem, fontes congeladas, resultados e segredos.

Não gera ZIP/baseline, não autentica, não executa SQL e não acessa o remoto.
Valores privados são comparados somente em memória e nunca impressos.
"""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[2]
LAB = ROOT / "04_BANCO_E_SUPABASE/laboratorio-marco-4a"
ORIGIN = ROOT / "outputs/Metallo-Marco3H-BaselineAprovada-20261001-R1.zip"
EXPECTED = "389137f649221344292ee85d5602f3fbc0c746ce68b4107ee2b607c8b3f084bd"
sha = lambda raw: hashlib.sha256(raw).hexdigest()


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


secrets = set()


def collect_private(value):
    if isinstance(value, dict):
        for key, child in value.items():
            if isinstance(child, str) and re.search(r"password|senha|token|secret|key", key, re.I) and len(child) >= 12:
                if not re.search(r"anon|publishable", key, re.I):
                    secrets.add(child)
            else:
                collect_private(child)
    elif isinstance(value, list):
        for child in value:
            collect_private(child)


for path in (ROOT / "backups").glob("credenciais-previa*.json"):
    collect_private(read_json(path))
for path in (ROOT / "01_WEB").glob(".env*"):
    if path.is_file():
        for line in path.read_text(encoding="utf-8-sig", errors="ignore").splitlines():
            match = re.match(r"\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.+?)\s*$", line)
            if match and re.search(r"SECRET|TOKEN|PASSWORD|KEY", match[1]) and not re.search(r"ANON|PUBLISHABLE", match[1]):
                value = match[2].strip("\"'")
                if len(value) >= 12:
                    secrets.add(value)

# CLI local; stdout contém chaves e é consumido exclusivamente em memória.
status = json.loads(subprocess.check_output([
    "C:/Program Files/nodejs/node.exe", str(ROOT / "node_modules/supabase/dist/supabase.js"),
    "status", "--workdir", str(ROOT / "04_BANCO_E_SUPABASE/laboratorio-marco-1a"), "-o", "json",
], stderr=subprocess.DEVNULL, text=True, encoding="utf-8"))
assert status["API_URL"] == "http://127.0.0.1:54321"
assert not (ROOT / "04_BANCO_E_SUPABASE/laboratorio-marco-1a/supabase/.temp/project-ref").exists()
for key in ("SERVICE_ROLE_KEY", "JWT_SECRET", "SECRET_KEY"):
    if isinstance(status.get(key), str) and len(status[key]) >= 12:
        secrets.add(status[key])

paths = {
    "01_WEB/03_FUNCOES_E_LOGICA/Ponto/geolocalizacao-evento.ts",
    "01_WEB/03_FUNCOES_E_LOGICA/Ponto/relogio-referencia.ts",
    "01_WEB/05_ACESSO_A_DADOS/Ponto/ponto-online.ts",
    "01_WEB/05_ACESSO_A_DADOS/Ponto/ponto-gestao.ts",
    "01_WEB/app/api/ponto-online/[...path]/route.ts",
    "01_WEB/app/colaborador/[[...screen]]/meu-ponto-online.tsx",
    "01_WEB/app/colaborador/[[...screen]]/colaborador-app.tsx",
    "01_WEB/app/colaborador/[[...screen]]/colaborador.module.css",
    "01_WEB/app/(02_SISTEMA)/ponto-laboratorio/page.tsx",
    "01_WEB/02_COMPONENTES_VISUAIS/sidebar-nav.tsx",
    "01_WEB/proxy.ts", "01_WEB/10_TESTES/ponto-online.test.tsx",
    "04_BANCO_E_SUPABASE/laboratorio-marco-1a/verificar-rede-local.mjs",
    "05_DOCUMENTACAO/47_MARCO_4A_MEU_PONTO_ONLINE_GEOLOCALIZACAO.md",
    "05_DOCUMENTACAO/MAPA_DO_METALLO.md",
}
for path in LAB.iterdir():
    if path.suffix in {".mjs", ".sql", ".py", ".json", ".log"} and path.name != "verificacao-final-4a.json":
        paths.add(path.relative_to(ROOT).as_posix())

bundles = set()
for directory in ("01_WEB/.next-local-preview/dev/static/chunks", "01_WEB/.next-gestao-preview/dev/static/chunks", "01_WEB/.next/static/chunks"):
    base = ROOT / directory
    if base.exists():
        bundles.update(p for p in base.rglob("*") if p.is_file() and p.suffix in {".js", ".css"})

patterns = (
    ("sb_secret", r"sb_secret_[A-Za-z0-9_-]{16,}"),
    ("private PEM", r"-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----"),
    ("refresh/access token literal", r"(?:refresh_token|refreshToken|access_token|accessToken)\s*[=:]\s*[\"'][A-Za-z0-9._-]{24,}[\"']"),
    ("service_role literal", r"(?:SERVICE_ROLE_KEY|service_role_key)\s*[=:]\s*[\"'][A-Za-z0-9._-]{24,}[\"']"),
    ("password literal", r"(?:password|senha)\s*[=:]\s*[\"'][^\"'\r\n]{12,}[\"']"),
    ("cookie literal", r"(?<![A-Za-z0-9_])(?:Set-Cookie:|Cookie:)\s+[^\\\r\n]{20,}"),
)
findings = []
reviewed_examples = []
# Exemplos públicos da documentação @supabase/auth-js, inspecionados nos comentários
# dos bundles. Exceção por hash exato e contexto, nunca por arquivo inteiro.
public_example_hashes = {
    "4ddfb4d009a1b5e9b96066012e9938964fae159dcd750668f47eda1fb3659d61",
    "39cc3212a766e41f58b7ba39291f4a062c94962d25104f30e387acd6b3f3cc26",
    "bd759ac61d5b17b5dc333bd0de629955d95e4565480a5a3809d7ad474271c7a0",
    "a5fd2fe86feca1bcab7db0b6938186ec891c3d0d1c9bf5b202d5b442671b912c",
}
allowed_public_keys = 0
inventory = []
for path in sorted({ROOT / p for p in paths} | bundles):
    assert path.is_file(), path.relative_to(ROOT).as_posix()
    content = path.read_text(encoding="utf-8-sig", errors="replace")
    relative = path.relative_to(ROOT).as_posix()
    if any(secret in content for secret in secrets):
        findings.append({"path": relative, "kind": "credencial privada conhecida; valor omitido"})
    for kind, pattern in patterns:
        for match in re.finditer(pattern, content, re.I):
            digest = sha(match.group().encode())
            preceding = content[max(0, match.start()-150):match.start()]
            if kind == "password literal" and path in bundles and digest in public_example_hashes and re.search(r"\n\s*\*", preceding):
                reviewed_examples.append({"path": relative, "match_sha256": digest, "reason": "exemplo público em comentário de documentação @supabase/auth-js; não é credencial do projeto"})
            else:
                findings.append({"path": relative, "kind": kind, "match_sha256": digest})
    for match in re.finditer(r"eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{12,}", content):
        # A chave ANON pública local já aprovada pode estar no bundle. Token pessoal não pode.
        literal = match.group()
        if literal == status["ANON_KEY"]:
            allowed_public_keys += 1
        else:
            findings.append({"path": relative, "kind": "JWT literal não público"})
    if path not in bundles:
        raw = path.read_bytes()
        inventory.append({"path": relative, "bytes": len(raw), "sha256": sha(raw)})

with zipfile.ZipFile(ORIGIN) as archive:
    manifest = json.loads(archive.read("MANIFESTO_SHA256.json"))
    assert manifest["id"] == "METALLO-3H-LAB-20261001-R1"
    for entry in manifest["files"]:
        assert sha(archive.read(entry["path"])) == entry["sha256"]
    core_files = [p for p in archive.namelist() if "/laboratorio-marco-2" in p and p.endswith((".mjs", ".sql", ".py"))]
    frozen = [{"path": p, "identical": (ROOT / p).is_file() and (ROOT / p).read_bytes() == archive.read(p)} for p in core_files]
    changes = []
    for p in sorted(paths):
        if p in archive.namelist():
            if (ROOT / p).read_bytes() != archive.read(p):
                changes.append({"path": p, "status": "DIFFERENT_FROM_3H"})
        else:
            changes.append({"path": p, "status": "NOT_IN_3H_INVENTORY"})

proof = read_json(LAB / "resultado-4a.json")
web = read_json(LAB / "web-completa-4a.json")
network = read_json(LAB / "rede.json")
core_proof = read_json(ROOT / "04_BANCO_E_SUPABASE/laboratorio-marco-2f/resultado-2f.json")
gps = (ROOT / "01_WEB/03_FUNCOES_E_LOGICA/Ponto/geolocalizacao-evento.ts").read_text(encoding="utf-8")
gates = {
    "origin_sha256_identical": sha(ORIGIN.read_bytes()) == EXPECTED,
    "frozen_core_sources_identical": all(row["identical"] for row in frozen),
    "4a_80": proof["passed"] and len(proof["checks"]) == 80 and all(c["ok"] for c in proof["checks"]),
    "audit_13": read_json(LAB / "resultado-auditoria-4a.json")["passed"] and len(read_json(LAB / "resultado-auditoria-4a.json")["checks"]) == 13,
    "web_246": web["success"] and web["numTotalTests"] == web["numPassedTests"] == 246 and web["numFailedTests"] == 0,
    "2f_28": core_proof["passed"] and len(core_proof["checks"]) == 28 and all(c["ok"] for c in core_proof["checks"]),
    "network_8": network["passed"] and len(network["checks"]) == 8,
    "bank_31": bool(re.search(r"pass 31", (LAB / "banco.log").read_text(encoding="utf-8-sig"))),
    "quality_44": bool(re.search(r"pass 44", (LAB / "qualidade.log").read_text(encoding="utf-8-sig"))),
    "typecheck_empty_log": (LAB / "typecheck.log").stat().st_size == 0,
    "lint_zero_warnings_empty_log": (LAB / "lint.log").stat().st_size == 0,
    "build_success": "Compiled successfully" in (LAB / "build.log").read_text(encoding="utf-8-sig"),
    "one_shot_no_watch_api": len(re.findall(r"getCurrentPosition\s*\(", gps)) == 1 and not re.search(r"watchPosition\s*\(", gps),
    "no_private_secrets_in_scanned_sources_bundles_evidence": not findings,
}
report = {
    "at": datetime.now(timezone.utc).isoformat(),
    "scope": "SIMULAÇÃO SEM VALOR OFICIAL; fontes/evidências 4A e bundles locais; não é scan de ZIP nem baseline",
    "origin": {"id": manifest["id"], "sha256": sha(ORIGIN.read_bytes()), "manifest_entry_hashes_verified": True},
    "gates": gates, "passed": all(gates.values()),
    "frozen_core": frozen, "selected_changes_since_origin": changes,
    "source_and_evidence_files_scanned": len(paths), "client_bundles_scanned": len(bundles),
    "known_private_values_compared_only_in_memory": len(secrets),
    "local_anon_public_key_occurrences_allowed": allowed_public_keys,
    "reviewed_public_documentation_examples": reviewed_examples,
    "findings": findings, "inventory": inventory,
    "manual_approval": "APROVADA pelo responsável em 01/10/2026", "real_browser_zoom_100_200": "Não há prova automatizada nova de valor no menu; avaliação manual da interface concluída pelo responsável",
    "grok": "DOIS CICLOS PRESERVADOS E CONFRONTADOS; zero crítico/alto confirmado aberto", "baseline_4a": "NÃO CRIADA", "remote_changes": "NENHUMA AÇÃO REMOTA EXECUTADA",
}
(LAB / "verificacao-final-4a.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"passed": report["passed"], "gates": gates, "source_files": len(paths), "client_bundles": len(bundles), "findings": findings}, ensure_ascii=False))
raise SystemExit(0 if report["passed"] else 1)
