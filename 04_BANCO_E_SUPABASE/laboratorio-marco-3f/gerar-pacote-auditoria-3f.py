"""Empacota a auditoria passiva 3F e examina o ZIP, sem criar baseline."""

from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
import hashlib
import json
import re
import sys
import zipfile


ROOT = Path(__file__).resolve().parents[2]
LAB = ROOT / "04_BANCO_E_SUPABASE/laboratorio-marco-3f"
ORIGIN_ID = "METALLO-3E-LAB-20260929-R1"
ORIGIN_SHA = "7ffb4707ae0a6bd2c12cd5756284582cba8c4f31673569207b0a0552a3d86c8c"
ORIGIN = ROOT / "outputs/Metallo-Marco3E-BaselineAprovada-20260929-R1.zip"
assert len(sys.argv) == 2 and sys.argv[1] in {"1", "2", "scan1", "scan2"}
ARG = sys.argv[1]
CYCLE = ARG[-1]
TARGET = ROOT / f"outputs/Metallo-Marco3F-AssinaturaAuditoria-20260929-Ciclo{CYCLE}.zip"


def sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def read(path: str) -> bytes:
    return (ROOT / path).read_bytes()


def known_local_secrets() -> set[str]:
    """Compare only in memory; never place values in an output artifact."""
    values: set[str] = set()

    def collect(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if isinstance(child, str) and re.search(r"password|senha|token|secret|key", key, re.I) and len(child) >= 12:
                    values.add(child)
                else:
                    collect(child)
        elif isinstance(value, list):
            for child in value:
                collect(child)

    for path in (ROOT / "backups").glob("credenciais-previa*.json"):
        try:
            collect(json.loads(path.read_text(encoding="utf-8-sig")))
        except (UnicodeError, json.JSONDecodeError):
            continue
    for path in (ROOT / "01_WEB").glob(".env*"):
        if not path.is_file():
            continue
        for line in path.read_text(encoding="utf-8-sig", errors="ignore").splitlines():
            match = re.match(r"\s*(?:export\s+)?([A-Za-z0-9_]*(?:SECRET|TOKEN|PASSWORD|KEY)[A-Za-z0-9_]*)\s*=\s*(.+?)\s*$", line, re.I)
            if match:
                value = match.group(2).strip("\"'")
                if len(value) >= 12:
                    values.add(value)
    return values


PATTERNS = (
    ("JWT literal", r"eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{12,}"),
    ("sb_secret literal", r"sb_secret_[A-Za-z0-9_-]{16,}"),
    ("chave privada PEM", r"-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----"),
    ("cookie literal", r"(?:Set-Cookie:|Cookie:)\s+[^\r\n]{20,}"),
    ("refresh token literal", r"(?:refresh_token|refreshToken)\s*[=:]\s*[\"'][A-Za-z0-9._-]{24,}[\"']"),
    ("access token literal", r"(?:access_token|accessToken)\s*[=:]\s*[\"'][A-Za-z0-9._-]{24,}[\"']"),
    ("service_role literal", r"(?:SERVICE_ROLE_KEY|service_role_key)\s*[=:]\s*[\"'][A-Za-z0-9._-]{24,}[\"']"),
    ("senha literal", r"(?:password|senha)\s*[=:]\s*[\"'][^\"'\r\n]{12,}[\"']"),
    ("WebAuthn private key JWK", r"[\"']d[\"']\s*:\s*[\"'][A-Za-z0-9_-]{32,}[\"']"),
)
FORBIDDEN_PARTS = {"backups", "node_modules", ".git", ".temp", ".next", "cookies", "credentials", "credenciais", "storage"}
FORBIDDEN_EXTENSIONS = (".pem", ".pfx", ".p12", ".key", ".sqlite", ".db", ".dump", ".bak", ".pgdump", ".zip", ".map")


def scan_zip() -> None:
    assert TARGET.is_file(), "ZIP ausente"
    receipt_path = Path(str(TARGET) + ".verificacao.json")
    assert not receipt_path.exists(), "Recibo existente; não sobrescrever"
    known = known_local_secrets()
    findings = []
    with zipfile.ZipFile(TARGET) as archive:
        assert archive.testzip() is None, "ZIP corrompido"
        names = archive.namelist()
        manifest = json.loads(archive.read("MANIFESTO_SHA256.json"))
        assert manifest["id"] == f"METALLO-3F-AUDITORIA-CICLO{CYCLE}"
        assert len(names) == len(set(names)) == manifest["zip_entries"]
        assert set(names) == {row["path"] for row in manifest["files"]} | {"MANIFESTO_SHA256.json"}
        for row in manifest["files"]:
            raw = archive.read(row["path"])
            assert len(raw) == row["bytes"] and sha(raw) == row["sha256"], row["path"]
        for entry in archive.infolist():
            name = entry.filename
            parts = PurePosixPath(name).parts
            if (entry.is_dir() or not parts or name.startswith("/") or ".." in parts or ":" in name or "\\" in name
                or any(part.lower() in FORBIDDEN_PARTS or part.lower().startswith(".env") for part in parts)
                or name.lower().endswith(FORBIDDEN_EXTENSIONS)):
                findings.append({"path": name, "kind": "arquivo/caminho indevido"})
            raw = archive.read(entry)
            content = raw.decode("utf-8-sig", errors="ignore")
            for kind, pattern in PATTERNS:
                for match in re.finditer(pattern, content, re.I):
                    findings.append({"path": name, "kind": kind, "match_sha256": sha(match.group().encode())})
            if any(secret in content for secret in known):
                findings.append({"path": name, "kind": "credencial local conhecida"})
    receipt = {
        "at": datetime.now(timezone.utc).isoformat(),
        "scope": "scan direto de cada entrada do ZIP final 3F",
        "zip": {"path": TARGET.relative_to(ROOT).as_posix(), "sha256": sha(TARGET.read_bytes()), "entries": len(names)},
        "known_local_credentials_checked": len(known),
        "manifest_and_entry_hashes_verified": True,
        "values_redacted": True,
        "findings": findings,
        "passed": not findings,
        "is_approved_baseline": False,
    }
    receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if findings:
        print(json.dumps({"passed": False, "findings": findings}, ensure_ascii=False))
        sys.exit(1)
    Path(str(TARGET) + ".sha256").write_text(f"{receipt['zip']['sha256']}  {TARGET.name}\n", encoding="ascii")
    print(json.dumps({"passed": True, "zip": str(TARGET), "sha256": receipt["zip"]["sha256"],
                      "files": len(manifest["files"]), "entries": len(names), "confirmed_findings": 0}, ensure_ascii=False))


assert sha(ORIGIN.read_bytes()) == ORIGIN_SHA, "Baseline 3E alterada"
assert not (ROOT / "04_BANCO_E_SUPABASE/laboratorio-marco-1a/supabase/.temp/project-ref").exists(), "Laboratório ligado ao remoto"
if ARG.startswith("scan"):
    scan_zip()
    sys.exit(0)

assert not TARGET.exists(), "Pacote existente; não sobrescrever"
result = json.loads((LAB / "resultado-3f.json").read_text(encoding="utf-8-sig"))
expected_integrated = 56 if CYCLE == "1" else 58
assert result["passed"] == result["total"] == expected_integrated and len(result["checks"]) == expected_integrated
assert all(row["ok"] for row in result["checks"])
with zipfile.ZipFile(ORIGIN) as archive:
    origin_manifest_raw = archive.read("MANIFESTO_SHA256.json")
    origin_manifest = json.loads(origin_manifest_raw)
    assert origin_manifest["id"] == ORIGIN_ID
    origin_hashes = {row["path"]: row["sha256"] for row in origin_manifest["files"]}
    assert all(sha(archive.read(path)) == hash_value for path, hash_value in origin_hashes.items())

paths = {
    "AGENTS.md", "01_WEB/package.json", "01_WEB/proxy.ts",
    "01_WEB/03_FUNCOES_E_LOGICA/Assinatura/epi-signature-3f.ts",
    "01_WEB/03_FUNCOES_E_LOGICA/Assinatura/assinatura-servico-3f.ts",
    "01_WEB/03_FUNCOES_E_LOGICA/Autenticacao/session.ts",
    "01_WEB/03_FUNCOES_E_LOGICA/Autenticacao/use-colaborador-session.ts",
    "01_WEB/03_FUNCOES_E_LOGICA/Relatorios/epi-report-3e.ts",
    "01_WEB/04_SERVICOS/assinatura-browser-3f.ts",
    "01_WEB/05_ACESSO_A_DADOS/Assinatura/assinatura-local-3f.ts",
    "01_WEB/05_ACESSO_A_DADOS/Supabase/colaborador-local.ts",
    "01_WEB/09_CONFIGURACOES/colaborador-laboratorio.ts",
    "01_WEB/10_TESTES/colaborador-assinatura-3f.test.tsx",
    "01_WEB/10_TESTES/colaborador-seguranca.test.ts",
    "01_WEB/10_TESTES/colaborador-recebimento-epi.test.tsx",
    "01_WEB/app/api/laboratorio/assinatura-epi/route.ts",
    "01_WEB/app/colaborador/[[...screen]]/assinatura-seguranca-3f.tsx",
    "01_WEB/app/colaborador/[[...screen]]/epi-assinatura-3f.tsx",
    "01_WEB/app/colaborador/[[...screen]]/epi-recebimento.tsx",
    "01_WEB/app/colaborador/[[...screen]]/meu-perfil.tsx",
    "01_WEB/app/colaborador/[[...screen]]/meus-epis.tsx",
    "01_WEB/app/colaborador/[[...screen]]/colaborador-app.tsx",
    "01_WEB/app/colaborador/[[...screen]]/colaborador.module.css",
    "01_WEB/app/colaborador/[[...screen]]/page.tsx",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3f/contrato-assinatura-local.sql",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3f/provas-3f.mjs",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3f/resultado-3f.json",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3d/contrato-entrega-confirmacao.sql",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3e/contrato-ficha-historico.sql",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260925120000_employee_identity_foundation.sql",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260926213000_portal_profile_optional_team.sql",
    "05_DOCUMENTACAO/42_MARCO_3D_ENTREGA_CONFIRMACAO_EPI.md",
    "05_DOCUMENTACAO/43_MARCO_3E_FICHA_HISTORICO_EPI_PDF.md",
    "05_DOCUMENTACAO/44_MARCO_3F_ASSINATURA_RECEBIMENTO_EPI.md",
}
if CYCLE == "2":
    paths.update({
        "04_BANCO_E_SUPABASE/laboratorio-marco-3f/parecer-grok-ciclo1-original.pdf",
        "04_BANCO_E_SUPABASE/laboratorio-marco-3f/web-ciclo1-final.log",
        "04_BANCO_E_SUPABASE/laboratorio-marco-3f/build-ciclo1-final.log",
        "04_BANCO_E_SUPABASE/laboratorio-marco-3f/gerar-pacote-auditoria-3f.py",
    })
payload = {name: read(name) for name in sorted(paths)}
payload["BASELINE_3E_MANIFESTO.json"] = origin_manifest_raw
prompt = f"""# Auditoria adversarial independente — Marco 3F, ciclo {CYCLE}

Inspecione integralmente o ZIP anexado. Confira o SHA-256 do ZIP informado no envio,
o manifesto e os hashes de cada entrada. Origem imutável: {ORIGIN_ID}, SHA-256
{ORIGIN_SHA}; o manifesto da origem está incluído, mas não o ZIP completo: não afirme
ter recomputado o hash da origem. O 3F é somente laboratório sintético, sem baseline.
SIMULAÇÃO SEM VALOR OFICIAL. O responsável aprovou manualmente 100% e 200%, a
cerimônia real no autenticador do Windows/Edge, duas confirmações, revogação,
troca de método e logout/login. Resultados locais atuais: {expected_integrated}/{expected_integrated}
integrado, {"9/9" if CYCLE == "1" else "16/16"} direcionado,
{"183/183" if CYCLE == "1" else "185/185"} Web; as suítes se sobrepõem. Não são execução independente sua.

Você é AUDITOR, não desenvolvedor. Permita somente inspeção passiva no SEU ambiente:
listar, abrir, extrair ZIP, pesquisar texto, comparar e calcular hashes. PROIBIDO
executar scripts do projeto, SQL, migrations, testes, Auth, containers, endpoints,
localhost/rede do laboratório; modificar o projeto ou acessar Supabase remoto.

Examine adversarialmente: origem e RP ID (localhost, 127.0.0.1, porta, headers,
proxy, ausente/incorreta); desafios de cadastro/assinatura (entropia, expiração,
sessão, titular, grupo, transação, payload, hash, uso único, concorrência/replay);
UV/UP, algoritmos, chave pública, contador/clonagem, credencial desconhecida;
João→Maria/Maria→João por URL/body/query/header/estado/cache e IDs manipulados;
servidor/Gestão fabricando assinatura, mock ou fallback; canonicalização (ordem,
null, Unicode, números, datas/timezone, encoding e versão); snapshot histórico
versus catálogo alterado; SHA-256 não confundido com assinatura; retry, duplo clique,
duas abas, troca de conta/logout durante cerimônia; revogação durante assinatura,
múltiplos métodos/dispositivos, recuperação de login, identidade/funcionário inativos;
RLS/grants/constraints/append-only/SECURITY DEFINER envolvidos; confirmação comum
versus reforçada, offline, mensagens de erro, limites/abuso/DoS, privacidade e
metadados do autenticador. Confira a matriz técnico-jurídica sem atribuir valor
jurídico definitivo, ICP-Brasil, REP-P, produção ou ponto oficial.

Produza TODOS os achados numerados F-3F-XX. Para cada: ID, severidade, estado
CONFIRMADO/PARCIAL/HIPÓTESE/LACUNA DE EVIDÊNCIA/RISCO FUTURO, arquivo/linha,
condição, caminho da falha, evidência, impacto, correção mínima e teste de aceitação.
Não trate hipótese como vulnerabilidade comprovada. Diga se existe CRÍTICO/ALTO
confirmado e aberto no escopo local e quais riscos médios/baixos persistem.
Não aprove baseline, produção, remoto ou publicação.
"""
if CYCLE == "2":
    prompt += """
SEGUNDO E ÚLTIMO CICLO: o parecer original do ciclo 1 está no pacote em PDF. Confronte
os 34 achados F-3F-01 a F-3F-34 com a tabela de confronto da documentação e com
código, SQL e testes atualizados. Examine em especial: F-3F-12 (todas as credenciais
ativas na escolha padrão, seleção explícita restrita), F-3F-24 (estado de assinatura
indisponível não rotulado como confirmação comum; histórico sem corte arbitrário) e
F-3F-27 (assertion com user presence ausente rejeitada pelo verificador). Diga quais
correções estão comprovadas por inspeção estática e quais exigiriam execução externa.
Declare o estado final de cada achado e se há CRÍTICO/ALTO confirmado e aberto.
Não solicite terceiro ciclo.
"""
payload["PROMPT_REVISAO_SOMENTE_LEITURA.md"] = prompt.encode("utf-8")
payload["LEIA-ME.md"] = (f"# Marco 3F — auditoria passiva ciclo {CYCLE}\n\n"
    "SIMULAÇÃO SEM VALOR OFICIAL. Código/SQL/testes/documentação selecionados para revisão estática; "
    "não é checkout executável nem backup. A baseline 3E permanece intacta. Sem baseline 3F, "
    "remoto, produção, funcionários reais, publicação, ponto oficial ou REP-P. "
    "O recibo externo contém o hash do ZIP e o scan direto para evitar autorreferência.\n").encode("utf-8")
files = [{"path": name, "bytes": len(raw), "sha256": sha(raw)} for name, raw in sorted(payload.items())]
manifest = {
    "id": f"METALLO-3F-AUDITORIA-CICLO{CYCLE}", "is_approved_baseline": False,
    "at": datetime.now(timezone.utc).isoformat(), "mandatory_label": "SIMULAÇÃO SEM VALOR OFICIAL",
    "origin": {"id": ORIGIN_ID, "sha256": ORIGIN_SHA, "manifest_sha256": sha(origin_manifest_raw),
               "all_origin_entry_hashes_verified_locally": True, "full_origin_zip_included": False},
    "manual_approval": "responsável aprovou 100%/200%, cerimônia real, duas confirmações, revogação, novo método e logout/login",
    "results": {"3f_integrated": f"{expected_integrated}/{expected_integrated}", "3f_focused": "9/9" if CYCLE == "1" else "16/16", "web_complete": "183/183" if CYCLE == "1" else "185/185",
                "TypeScript": "pass", "lint": "pass", "build": "pass", "overlapping_suites_do_not_sum": True},
    "limits": ["laboratório sintético", "Supabase remoto intocado", "sem funcionários reais", "sem publicação",
               "sem baseline 3F", "não é produção, ponto oficial, REP-P ou assinatura juridicamente classificada"],
    "files": files, "inventory_count": len(files), "zip_entries": len(files) + 1,
    "delta_from_3e": [{"path": name, "kind": "changed" if name in origin_hashes else "new",
                       "origin_sha256": origin_hashes.get(name), "current_sha256": sha(raw)}
                      for name, raw in sorted(payload.items()) if not name.startswith("BASELINE_3E_")
                      and origin_hashes.get(name) != sha(raw)],
    "secret_scan_receipt": TARGET.relative_to(ROOT).as_posix() + ".verificacao.json",
}
if CYCLE == "2":
    manifest["cycle1_opinion_sha256"] = sha(read("04_BANCO_E_SUPABASE/laboratorio-marco-3f/parecer-grok-ciclo1-original.pdf"))
payload["MANIFESTO_SHA256.json"] = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
with zipfile.ZipFile(TARGET, "x", zipfile.ZIP_DEFLATED) as archive:
    for name, raw in sorted(payload.items()):
        archive.writestr(name, raw)
print(json.dumps({"zip": str(TARGET), "sha256": sha(TARGET.read_bytes()), "files": len(files),
                  "entries": len(payload), "delta": len(manifest["delta_from_3e"]), "baseline_created": False}, ensure_ascii=False))
