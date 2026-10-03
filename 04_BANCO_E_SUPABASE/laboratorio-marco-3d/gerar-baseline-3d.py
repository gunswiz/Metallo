"""Congela o Marco 3D aprovado a partir da baseline 3C e examina o ZIP final.

Somente arquivos locais: nenhuma conexão com Supabase ou reexecução de testes.
"""

from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
import hashlib
import json
import re
import stat
import zipfile


ROOT = Path(__file__).resolve().parents[2]
OUTPUTS = ROOT / "outputs"
LAB = ROOT / "04_BANCO_E_SUPABASE/laboratorio-marco-3d"
BASELINE_ID = "METALLO-3D-LAB-20260929-R1"
PARENT_ID = "METALLO-3C-LAB-20260928-R1"
PARENT = OUTPUTS / "Metallo-Marco3C-BaselineAprovada-20260928-R1.zip"
PARENT_SHA = "bf3f1bb34813f03afaa9fac613ef4ede24a0f35f3ca3292670dda230cc63c3a6"
AUDIT_1 = OUTPUTS / "Metallo-Marco3D-EntregaConfirmacao-Auditoria-20260929-Ciclo1.zip"
AUDIT_1_SHA = "1f5ef6b268f9eafc215b0d11547fdf18e2ad6b0c90d166d8badf6bd55d2879cc"
AUDIT_2 = OUTPUTS / "Metallo-Marco3D-EntregaConfirmacao-Auditoria-20260929-Ciclo2.zip"
AUDIT_2_SHA = "7d4e62ddb17aa8cbc43fd5dd2f360391ffa332be9b664df9ac543750da65fb06"
OPINION_1_SHA = "76708e470d902e2fe54a95fe1f070e39bb9d9de9e825a0c54457851922adf500"
OPINION_2_SHA = "ec63438981cbcf29fcfd40c5fe06f4457f10a97d46fa9268af179280290979c8"
TARGET = OUTPUTS / "Metallo-Marco3D-BaselineAprovada-20260929-R1.zip"


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def content(path: str) -> bytes:
    return (ROOT / path).read_bytes()


def checked_archive(path: Path, expected_id: str):
    with zipfile.ZipFile(path) as archive:
        assert archive.testzip() is None, f"ZIP corrompido: {path.name}"
        names = archive.namelist()
        assert len(names) == len(set(names)), f"Entradas duplicadas: {path.name}"
        manifest = json.loads(archive.read("MANIFESTO_SHA256.json"))
        assert manifest["id"] == expected_id
        rows = manifest["files"]
        assert manifest["inventory_count"] == len(rows)
        assert len(names) == len(rows) + 1
        assert set(names) == {row["path"] for row in rows} | {"MANIFESTO_SHA256.json"}
        files = {}
        for row in rows:
            data = archive.read(row["path"])
            assert len(data) == row["bytes"] and sha(data) == row["sha256"], row["path"]
            files[row["path"]] = data
    return manifest, files


def check_result(path: str, count: int):
    result = json.loads(content(path))
    checks = result["checks"]
    assert len(checks) == count and all(check["ok"] for check in checks)
    assert result.get("count", count) == count and result.get("passed", True)


def local_secrets():
    values = set()

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
    return values


PATTERNS = (
    ("JWT literal", r"eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{12,}"),
    ("sb_secret literal", r"sb_secret_[A-Za-z0-9_-]{16,}"),
    ("chave privada PEM", r"-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----"),
    ("cookie literal", r"(?:Set-Cookie:|Cookie:)\s+[^\r\n]{20,}"),
    ("refresh token literal", r"(?:refresh_token|refreshToken)\s*[=:]\s*[\"'][A-Za-z0-9._-]{24,}[\"']"),
    ("service_role literal", r"(?:SERVICE_ROLE_KEY|service_role_key)\s*[=:]\s*[\"'][A-Za-z0-9._-]{24,}[\"']"),
    ("senha literal", r"(?:password|senha)\s*[=:]\s*[\"'][^\"'\r\n]{12,}[\"']"),
)
FORBIDDEN_PARTS = {"backups", "node_modules", ".git", ".temp", ".next", "cookies", "credentials", "credenciais"}
FORBIDDEN_EXTENSIONS = (".pem", ".pfx", ".p12", ".key", ".sqlite", ".db", ".dump", ".bak", ".pgdump", ".zip")


def scan_entry(name: str, raw: bytes, known_values: set[str]):
    findings = []
    parts = PurePosixPath(name).parts
    if (not parts or name.startswith("/") or ".." in parts or "\\" in name or ":" in name
        or any(part.lower() in FORBIDDEN_PARTS or part.lower().startswith(".env") for part in parts)):
        findings.append({"path": name, "kind": "arquivo/caminho indevido"})
    if name.lower().endswith(FORBIDDEN_EXTENSIONS):
        findings.append({"path": name, "kind": "chave, dump ou ZIP aninhado"})
    text = raw.decode("utf-8", errors="ignore")
    for kind, pattern in PATTERNS:
        if re.search(pattern, text, re.I):
            findings.append({"path": name, "kind": kind})
    if any(secret in text for secret in known_values):
        findings.append({"path": name, "kind": "credencial local conhecida"})
    return findings


def scan_payload(files: dict[str, bytes], known_values: set[str]):
    return [finding for name, raw in files.items() for finding in scan_entry(name, raw, known_values)]


assert not (ROOT / "04_BANCO_E_SUPABASE/laboratorio-marco-1a/supabase/.temp/project-ref").exists(), "Laboratório vinculado ao remoto"
for path in (TARGET, Path(str(TARGET) + ".sha256"), Path(str(TARGET) + ".verificacao.json")):
    assert not path.exists(), f"Destino existente: {path.name}"
assert sha(PARENT.read_bytes()) == PARENT_SHA, "Baseline 3C alterada"
assert sha(AUDIT_1.read_bytes()) == AUDIT_1_SHA, "Auditoria ciclo 1 alterada"
assert sha(AUDIT_2.read_bytes()) == AUDIT_2_SHA, "Auditoria ciclo 2 alterada"
assert sha(content("04_BANCO_E_SUPABASE/laboratorio-marco-3d/parecer-grok-ciclo1.md")) == OPINION_1_SHA
assert sha(content("04_BANCO_E_SUPABASE/laboratorio-marco-3d/parecer-grok-ciclo2.md")) == OPINION_2_SHA
previous_baselines = {path.name: sha(path.read_bytes()) for path in OUTPUTS.glob("Metallo-*-Baseline*.zip")}
assert previous_baselines[PARENT.name] == PARENT_SHA

parent_manifest, inherited = checked_archive(PARENT, PARENT_ID)
audit_manifest, audited = checked_archive(AUDIT_2, "METALLO-3D-AUDITORIA-CICLO2")
assert audit_manifest["zip_entries"] == 68 and audit_manifest["inventory_count"] == 67
assert audit_manifest["results"]["3D_Auth_JWT_PostgREST"] == "77/77"
assert audit_manifest["results"]["Web_final"] == "148/148"
audit_receipt = json.loads(Path(str(AUDIT_2) + ".verificacao.json").read_text(encoding="utf-8"))
assert audit_receipt["passed"] and audit_receipt["findings"] == [] and audit_receipt["zip"]["sha256"] == AUDIT_2_SHA

check_result("04_BANCO_E_SUPABASE/laboratorio-marco-3d/resultado-3d.json", 77)
for stage, count in (("3c", 70), ("3b", 48), ("3a", 49)):
    check_result(f"04_BANCO_E_SUPABASE/laboratorio-marco-{stage}/resultado-{stage}.json", count)
network = json.loads(content("04_BANCO_E_SUPABASE/laboratorio-marco-3d/rede.json"))
assert network["passed"] and len(network["checks"]) == 8 and all(item["ok"] for item in network["checks"])
assert "148 passed (148)" in content("04_BANCO_E_SUPABASE/laboratorio-marco-3d/web-final.log").decode("utf-8-sig")
for label, count in (("banco", 31), ("qualidade", 44)):
    log = content(f"04_BANCO_E_SUPABASE/laboratorio-marco-3d/{label}-final.log").decode("utf-8-sig")
    assert re.search(rf"\bpass {count}\b", log) and re.search(r"\bfail 0\b", log)
for label in ("typecheck", "lint"):
    assert "exit_code=0" in content(f"04_BANCO_E_SUPABASE/laboratorio-marco-3d/{label}-final.log").decode("utf-8-sig")
assert "Compiled successfully" in content("04_BANCO_E_SUPABASE/laboratorio-marco-3d/build-final.log").decode("utf-8-sig")

payload = dict(inherited)
audited_source_count = 0
for name, data in audited.items():
    if name.startswith("BASELINE_3C_RELEVANTE/") or name == "LEIA-ME.md":
        continue
    if name.startswith(("01_WEB/", "04_BANCO_E_SUPABASE/", "05_DOCUMENTACAO/")) or name == "AGENTS.md":
        if name != "05_DOCUMENTACAO/42_MARCO_3D_ENTREGA_CONFIRMACAO_EPI.md":
            assert sha(content(name)) == sha(data), f"Fonte alterada após auditoria: {name}"
            audited_source_count += 1
    payload[name] = data

for name in (
    "05_DOCUMENTACAO/42_MARCO_3D_ENTREGA_CONFIRMACAO_EPI.md",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3d/parecer-grok-ciclo2.md",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3d/gerar-baseline-3d.py",
    "outputs/Metallo-Marco3D-EntregaConfirmacao-Auditoria-20260929-Ciclo2.zip.verificacao.json",
):
    payload[name] = content(name)

limits = [
    "SIMULAÇÃO SEM VALOR OFICIAL", "SUPABASE REMOTO INTOCADO", "NÃO IMPLANTADO NO SUPABASE REMOTO",
    "SEM FUNCIONÁRIOS REAIS", "NÃO É PRODUÇÃO", "NÃO É PONTO OFICIAL", "NÃO É CONFORMIDADE REP-P",
    "NÃO AUTORIZA PUBLICAÇÃO", "NÚCLEO DE PONTO 2F CONGELADO", "SEM MARCO 3E/PDF NESTE FECHAMENTO",
]
payload["LEIA-ME.md"] = (f"# {BASELINE_ID}\n\n"
    "MARCO 3D — ENTREGA E CONFIRMAÇÃO DE EPI FUNCIONAL EM LABORATÓRIO.\n\n"
    "Fotografia aprovada pelo responsável após avaliação visual em 100% e 200% e dois ciclos Grok "
    "independentes, preservados e confrontados. Origem imutável "
    f"{PARENT_ID}, SHA-256 {PARENT_SHA}. "
    "Consulte 05_DOCUMENTACAO/42_MARCO_3D_ENTREGA_CONFIRMACAO_EPI.md para fluxo, resultados, "
    "confronto de todos os achados, riscos e próxima direção. O manifesto contém inventário, hashes e delta "
    "desde 3C. O recibo de secret scan fica fora do ZIP para evitar autorreferência; a baseline só deve ser "
    "considerada íntegra quando o recibo passed=true referir exatamente o SHA-256 deste ZIP.\n\n"
    "É fotografia selecionada de código e evidências, não checkout completo nem backup de banco. "
    "Nenhuma senha, .env, JWT, refresh token, dump ou dado real deve constar no pacote.\n\n"
    + "; ".join(limits) + ".\n").encode("utf-8")

parent_hashes = {name: sha(data) for name, data in inherited.items()}
rows = [{"path": name, "bytes": len(data), "sha256": sha(data),
         "source": "3c_preservado" if parent_hashes.get(name) == sha(data)
         else "3c_atualizado" if name in parent_hashes else "3d_adicionado"}
        for name, data in sorted(payload.items())]
delta = [{"path": name, "kind": "alterado" if name in parent_hashes else "novo",
          "sha256_3c": parent_hashes.get(name), "sha256_3d": sha(data)}
         for name, data in sorted(payload.items()) if parent_hashes.get(name) != sha(data)]
manifest = {
    "id": BASELINE_ID, "is_approved_baseline": True, "at": datetime.now(timezone.utc).isoformat(),
    "status": "MARCO 3D — ENTREGA E CONFIRMAÇÃO DE EPI FUNCIONAL EM LABORATÓRIO",
    "document": "05_DOCUMENTACAO/42_MARCO_3D_ENTREGA_CONFIRMACAO_EPI.md",
    "parent": {"id": PARENT_ID, "zip": PARENT.name, "sha256": PARENT_SHA, "immutable": True},
    "formal_approval": {"by": "responsável", "visual": "Colaborador e Gestão aprovados em 100% e 200%",
        "navigation": ["Início", "Meu Ponto", "Meus EPIs", "Obras", "Minha Equipe", "Meu Perfil"],
        "baseline_id_explicitly_authorized": BASELINE_ID},
    "results": {"3d_real_Auth_JWT_PostgREST": "77/77", "web_complete": "148/148",
        "database": "31/31", "quality": "44/44", "TypeScript": "aprovado", "lint": "aprovado",
        "build": "aprovado", "3c_prior": "70/70", "3b_prior": "48/48", "3a_prior": "49/49",
        "network_prior": "8/8", "overlapping_suites_do_not_sum": True,
        "closure_reused_existing_evidence_without_rerunning_suites": True},
    "audits": {"cycles": 2, "status": "concluídos, preservados e confrontados",
        "cycle1": {"package_sha256": AUDIT_1_SHA,
            "opinion": "04_BANCO_E_SUPABASE/laboratorio-marco-3d/parecer-grok-ciclo1.md",
            "opinion_sha256": OPINION_1_SHA,
            "conversation": "https://grok.com/c/68a7a473-8a60-488c-955f-5a18e6fc7e7e"},
        "cycle2": {"package_sha256": AUDIT_2_SHA, "entries": 68, "manifest_files": 67,
            "secret_scan_direct_findings": 0,
            "opinion": "04_BANCO_E_SUPABASE/laboratorio-marco-3d/parecer-grok-ciclo2.md",
            "opinion_sha256": OPINION_2_SHA,
            "conversation": "https://grok.com/c/ee29afb6-0ad1-482a-9616-960ca994efbf"},
        "finding_confrontation": "05_DOCUMENTACAO/42_MARCO_3D_ENTREGA_CONFIRMACAO_EPI.md",
        "critical_or_high_confirmed_open": 0, "third_cycle": False,
        "method": "inspeção passiva do ZIP; auditor não executou projeto, SQL, Auth, testes ou rede do laboratório"},
    "corrections": ["motivo da divergência permanece visível à Gestão após resolução",
        "horário e mensagem pública apropriada visíveis ao titular",
        "confirmação permitida após resolução",
        "novos kits preservam e revalidam lote e marca"],
    "flow": "kit sugerido != kit preparado != entrega registrada != confirmação ou divergência pessoal",
    "source_of_delivery": "epi_deliveries; horário do servidor; Gestão registra; funcionário não cria entrega",
    "personal_confirmation": "acknowledgement posterior à entrega, sem assinatura digital qualificada",
    "exchange_3c": "aprovação não cria entrega; entrega pode vincular pedido sem encerrar automaticamente EPI anterior",
    "new_delivery_snapshots": ["nome/código/unidade do EPI", "CA", "quantidade", "tamanho/variante",
        "lote", "marca/modelo", "horário e responsável", "agrupamento", "kit e pedido 3C",
        "funcionário/função/equipe/obra quando presentes", "eventos de confirmação/divergência/tratamento"],
    "legacy_history_backfilled": False,
    "residual_risks": ["F-3D-01 coexistência com entregas legadas sem grupo 3D",
        "F-3D-03 fechamento parcial legado de linha 3D",
        "F-3D-07 dois kits pendentes em abas diferentes",
        "F-3D-09 helper global NULL legado; guardas específicas preservadas",
        "projeção da linha do tempo incompleta no portal e na Gestão para 3E",
        "riscos herdados de revogação, token residual, sessão/logout e controle do host",
        "ausência de ensaio em segundo computador físico", "evidência apenas de laboratório sintético"],
    "next_direction_only": "Marco 3E — Ficha e Histórico de EPI em PDF; não implementado",
    "limits": limits, "remote_not_touched_during_closure": True, "published": False,
    "delta_from_3c": delta, "delta_count": len(delta),
    "inventory_count": len(rows), "files": rows, "zip_entries": len(rows) + 1,
    "secret_scan_receipt": TARGET.name + ".verificacao.json",
    "approval_condition": "recibo externo passed=true com o SHA-256 exato do ZIP; scan direto zero achados",
    "audited_source_files_unchanged": audited_source_count,
}
payload["MANIFESTO_SHA256.json"] = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
known_values = local_secrets()
pre_findings = scan_payload(payload, known_values)
assert not pre_findings, json.dumps({"stage": "prévia do conteúdo", "findings": pre_findings}, ensure_ascii=False)

with zipfile.ZipFile(TARGET, "x", zipfile.ZIP_DEFLATED) as archive:
    for name, data in sorted(payload.items()):
        archive.writestr(name, data)

findings = []
with zipfile.ZipFile(TARGET) as archive:
    assert archive.testzip() is None
    names = archive.namelist()
    assert len(names) == len(set(names)) == manifest["zip_entries"]
    assert set(names) == {row["path"] for row in rows} | {"MANIFESTO_SHA256.json"}
    for row in rows:
        data = archive.read(row["path"])
        assert len(data) == row["bytes"] and sha(data) == row["sha256"], row["path"]
    for item in archive.infolist():
        if item.is_dir() or stat.S_ISLNK(item.external_attr >> 16):
            findings.append({"path": item.filename, "kind": "diretório/symlink indevido"})
        findings += scan_entry(item.filename, archive.read(item), known_values)

zip_sha = sha(TARGET.read_bytes())
receipt = {"at": datetime.now(timezone.utc).isoformat(), "id": BASELINE_ID,
    "scope": "secret scan diretamente no ZIP final da baseline 3D, todas as entradas",
    "zip": {"path": TARGET.relative_to(ROOT).as_posix(), "sha256": zip_sha,
        "entries": len(names), "manifest_files_verified": len(rows)},
    "delta_from_3c": len(delta), "known_local_credentials_checked": len(known_values),
    "patterns_checked": [name for name, _ in PATTERNS],
    "findings": findings, "passed": not findings,
    "older_baselines_preserved": all(sha((OUTPUTS / name).read_bytes()) == old
        for name, old in previous_baselines.items()),
    "audit_1_preserved": sha(AUDIT_1.read_bytes()) == AUDIT_1_SHA,
    "audit_2_preserved": sha(AUDIT_2.read_bytes()) == AUDIT_2_SHA,
    "remote_not_touched_during_closure": True, "published": False}
assert receipt["older_baselines_preserved"] and receipt["audit_1_preserved"] and receipt["audit_2_preserved"]
Path(str(TARGET) + ".verificacao.json").write_text(
    json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
if findings:
    print(json.dumps({"passed": False, "zip": str(TARGET), "findings": findings}, ensure_ascii=False))
    raise SystemExit(1)
Path(str(TARGET) + ".sha256").write_text(f"{zip_sha}  {TARGET.name}\n", encoding="ascii")
print(json.dumps({"passed": True, "id": BASELINE_ID, "zip": str(TARGET),
    "sha256": zip_sha, "files": len(rows), "entries": len(names),
    "delta_from_3c": len(delta), "secret_findings": 0}, ensure_ascii=False))
