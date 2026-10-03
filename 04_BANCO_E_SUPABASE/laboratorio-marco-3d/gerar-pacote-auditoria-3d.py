"""Gera e examina o pacote 3D para auditoria passiva, sem criar baseline."""

from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
import hashlib
import json
import re
import sys
import zipfile


ROOT = Path(__file__).resolve().parents[2]
ORIGIN_ID = "METALLO-3C-LAB-20260928-R1"
ORIGIN_SHA = "bf3f1bb34813f03afaa9fac613ef4ede24a0f35f3ca3292670dda230cc63c3a6"
ORIGIN = ROOT / "outputs/Metallo-Marco3C-BaselineAprovada-20260928-R1.zip"
assert len(sys.argv) == 2 and sys.argv[1] in {"1", "2", "scan1", "scan2"}, "Uso: script 1|scan1|2|scan2"
ARG = sys.argv[1]
CYCLE = ARG[-1]
TARGET = ROOT / f"outputs/Metallo-Marco3D-EntregaConfirmacao-Auditoria-20260929-Ciclo{CYCLE}.zip"


def sha(data):
    return hashlib.sha256(data).hexdigest()


assert sha(ORIGIN.read_bytes()) == ORIGIN_SHA, "Baseline 3C alterada"
assert not (ROOT / "04_BANCO_E_SUPABASE/laboratorio-marco-1a/supabase/.temp/project-ref").exists(), "CLI ligada ao remoto"
with zipfile.ZipFile(ORIGIN) as archive:
    previous_manifest = json.loads(archive.read("MANIFESTO_SHA256.json"))
assert previous_manifest["id"] == ORIGIN_ID
previous_hashes = {row["path"]: row["sha256"] for row in previous_manifest["files"]}


if ARG.startswith("scan"):
    assert TARGET.is_file(), "ZIP a examinar ausente"
    assert not Path(str(TARGET) + ".verificacao.json").exists(), "Recibo existente; não sobrescrever"
    findings = []
    known_values = set()
    for credentials in (ROOT / "backups").glob("credenciais-previa*.json"):
        try:
            values = json.loads(credentials.read_text(encoding="utf-8-sig"))
        except (UnicodeError, json.JSONDecodeError):
            continue
        def collect(value):
            if isinstance(value, dict):
                for key, child in value.items():
                    if isinstance(child, str) and re.search(r"password|senha|token|secret|key", key, re.I) and len(child) >= 12:
                        known_values.add(child)
                    else:
                        collect(child)
            elif isinstance(value, list):
                for child in value:
                    collect(child)
        collect(values)

    patterns = (
        ("JWT literal", r"eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{12,}"),
        ("sb_secret literal", r"sb_secret_[A-Za-z0-9_-]{16,}"),
        ("chave privada PEM", r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
        ("cookie literal", r"(?:Set-Cookie:|Cookie:)\s+[^\r\n]{20,}"),
        ("refresh token literal", r"(?:refresh_token|refreshToken)\s*[=:]\s*[\"'][A-Za-z0-9._-]{24,}[\"']"),
        ("service_role literal", r"(?:SERVICE_ROLE_KEY|service_role_key)\s*[=:]\s*[\"'][A-Za-z0-9._-]{24,}[\"']"),
        ("senha literal", r"(?:password|senha)\s*[=:]\s*[\"'][^\"'\r\n]{12,}[\"']"),
    )
    forbidden_parts = {"backups", "node_modules", ".git", ".temp", "cookies", "credentials", "credenciais"}
    with zipfile.ZipFile(TARGET) as archive:
        names = archive.namelist()
        assert len(names) == len(set(names)), "ZIP com caminhos duplicados"
        manifest = json.loads(archive.read("MANIFESTO_SHA256.json"))
        assert manifest["id"] == f"METALLO-3D-AUDITORIA-CICLO{CYCLE}"
        assert manifest["zip_entries"] == len(names)
        assert all(sha(archive.read(row["path"])) == row["sha256"] for row in manifest["files"])
        for item in archive.infolist():
            name = item.filename
            parts = PurePosixPath(name).parts
            if (item.is_dir() or not parts or name.startswith("/") or ".." in parts
                or any(part.lower() in forbidden_parts or part.lower().startswith(".env") for part in parts)):
                findings.append({"path": name, "kind": "arquivo/caminho indevido"})
                continue
            if re.search(r"\.(?:pem|pfx|p12|key|sqlite|db|dump|bak|pgdump|zip)$", name, re.I):
                findings.append({"path": name, "kind": "chave, dump ou ZIP aninhado"})
            raw = archive.read(item)
            content = raw.decode("utf-8", errors="ignore")
            for kind, pattern in patterns:
                if re.search(pattern, content, re.I):
                    findings.append({"path": name, "kind": kind})
            if any(secret in content for secret in known_values):
                findings.append({"path": name, "kind": "credencial local conhecida"})
    receipt = {
        "at": datetime.now(timezone.utc).isoformat(),
        "scope": "secret scan direto do ZIP final 3D, sem arquivos aninhados",
        "zip": {"path": TARGET.relative_to(ROOT).as_posix(), "sha256": sha(TARGET.read_bytes()), "entries": len(names)},
        "known_local_credentials_checked": len(known_values),
        "findings": findings, "passed": not findings,
    }
    Path(str(TARGET) + ".verificacao.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if findings:
        print(json.dumps({"passed": False, "findings": findings}, ensure_ascii=False))
        sys.exit(1)
    Path(str(TARGET) + ".sha256").write_text(f"{receipt['zip']['sha256']}  {TARGET.name}\n", encoding="ascii")
    print(json.dumps({"passed": True, "zip": str(TARGET), "sha256": receipt["zip"]["sha256"],
                      "entries": len(names), "findings": 0}, ensure_ascii=False))
    sys.exit(0)


assert not TARGET.exists(), "Pacote existente; não sobrescrever"
lab = ROOT / "04_BANCO_E_SUPABASE/laboratorio-marco-3d"
result = json.loads((lab / "resultado-3d.json").read_text(encoding="utf-8-sig"))
expected_3d = 68 if CYCLE == "1" else 77
expected_web = 147 if CYCLE == "1" else 148
assert result["passed"] and result["count"] == expected_3d and len(result["checks"]) == expected_3d
assert all(row["ok"] for row in result["checks"])
assert f"{expected_web} passed ({expected_web})" in (lab / "web-final.log").read_text(encoding="utf-8-sig")
for label, count in (("banco", 31), ("qualidade", 44)):
    log = (lab / f"{label}-final.log").read_text(encoding="utf-8-sig")
    assert re.search(rf"\bpass {count}\b", log) and re.search(r"\bfail 0\b", log), label
for label in ("typecheck", "lint"):
    assert "exit_code=0" in (lab / f"{label}-final.log").read_text(encoding="utf-8-sig"), label
assert "Compiled successfully" in (lab / "build-final.log").read_text(encoding="utf-8-sig")
network = json.loads((lab / "rede.json").read_text(encoding="utf-8-sig"))
assert network["passed"] and len(network["checks"]) == 8 and all(row["ok"] for row in network["checks"])

paths = [
    "AGENTS.md",
    "05_DOCUMENTACAO/40_MARCO_3B_MEUS_EPIS.md",
    "05_DOCUMENTACAO/41_MARCO_3C_SOLICITAR_TROCA_EPI.md",
    "05_DOCUMENTACAO/42_MARCO_3D_ENTREGA_CONFIRMACAO_EPI.md",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3b/contrato-epis.sql",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3c/contrato-troca-epi.sql",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3c/resultado-3c.json",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3d/contrato-entrega-confirmacao.sql",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3d/provas-3d.mjs",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3d/resultado-3d.json",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3d/rede.json",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3d/resultado-segredos-3d.json",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3d/gerar-pacote-auditoria-3d.py",
    *[f"04_BANCO_E_SUPABASE/laboratorio-marco-3d/{name}-final.log"
      for name in ("web", "banco", "qualidade", "typecheck", "lint", "build")],
    "04_BANCO_E_SUPABASE/supabase/migrations/20260902231312_epi_management.sql",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260903050000_epi_grouped_deliveries.sql",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260903070000_epi_employee_item_sets.sql",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260903133000_epi_stock_variants.sql",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260904193736_secure_epi_mutations.sql",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260907060320_close_partial_epi_delivery.sql",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260912073507_user_operation_permissions.sql",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260925120000_employee_identity_foundation.sql",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260926213000_portal_profile_optional_team.sql",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260926224000_unassigned_employee_management_scope.sql",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260926233500_personal_epi_explicit_team_scope.sql",
    "01_WEB/02_COMPONENTES_VISUAIS/epi-preparacao-3d.tsx",
    "01_WEB/02_COMPONENTES_VISUAIS/formulario-operacao.tsx",
    "01_WEB/03_FUNCOES_E_LOGICA/Autenticacao/use-colaborador-session.ts",
    "01_WEB/03_FUNCOES_E_LOGICA/Autenticacao/session.ts",
    "01_WEB/03_FUNCOES_E_LOGICA/executarOperacaoValidada.ts",
    "01_WEB/05_ACESSO_A_DADOS/Repositorios/epi-operacoes-repository.ts",
    "01_WEB/05_ACESSO_A_DADOS/Supabase/colaborador-local.ts",
    "01_WEB/05_ACESSO_A_DADOS/Supabase/server.ts",
    "01_WEB/09_CONFIGURACOES/ambienteSupabase.ts",
    "01_WEB/09_CONFIGURACOES/colaborador-laboratorio.ts",
    "01_WEB/app/(02_SISTEMA)/epis/entrega-em-lote/page.tsx",
    "01_WEB/app/(02_SISTEMA)/epis/solicitacoes/page.tsx",
    "01_WEB/app/actions/epi-completo.ts",
    "01_WEB/app/colaborador/[[...screen]]/colaborador-app.tsx",
    "01_WEB/app/colaborador/[[...screen]]/colaborador.module.css",
    "01_WEB/app/colaborador/[[...screen]]/epi-recebimento.tsx",
    "01_WEB/app/colaborador/[[...screen]]/epi-troca.tsx",
    "01_WEB/app/colaborador/[[...screen]]/meus-epis.tsx",
    "01_WEB/10_TESTES/colaborador-recebimento-epi.test.tsx",
    "01_WEB/10_TESTES/colaborador-preview.test.tsx",
    "01_WEB/10_TESTES/colaborador-troca-epi.test.tsx",
    "01_WEB/10_TESTES/colaborador-epis.test.tsx",
    "01_WEB/10_TESTES/colaborador-seguranca.test.ts",
]
if CYCLE == "2":
    paths += [
        "04_BANCO_E_SUPABASE/laboratorio-marco-3d/aplicar-ajustes-auditoria-3d.mjs",
        "04_BANCO_E_SUPABASE/laboratorio-marco-3d/parecer-grok-ciclo1.md",
        "outputs/Metallo-Marco3D-EntregaConfirmacao-Auditoria-20260929-Ciclo1.zip.verificacao.json",
    ]

payload = {}
for name in paths:
    parts = PurePosixPath(name).parts
    assert parts and ".." not in parts and not any(part in {".git", ".temp", "backups", "node_modules"} or part.startswith(".env") for part in parts), name
    assert not name.lower().endswith((".pem", ".key", ".pfx", ".p12", ".sqlite", ".db", ".zip")), name
    payload[name] = (ROOT / name).read_bytes()
payload["BASELINE_3C_MANIFESTO.json"] = (json.dumps(previous_manifest, ensure_ascii=False, indent=2) + "\n").encode()
with zipfile.ZipFile(ORIGIN) as origin_archive:
    for name in paths:
        if name in previous_hashes and name.startswith(("01_WEB/", "04_BANCO_E_SUPABASE/")):
            old = origin_archive.read(name)
            assert sha(old) == previous_hashes[name], name
            if sha(old) != sha(payload[name]):
                payload[f"BASELINE_3C_RELEVANTE/{name}"] = old

prompt = f"""# Auditoria adversarial independente — Marco 3D, ciclo {CYCLE}

Inspecione integralmente o ZIP anexado. Origem imutável {ORIGIN_ID}, SHA-256
{ORIGIN_SHA}. A aprovação visual das duas telas em 100% e 200% foi registrada.
**SIMULAÇÃO SEM VALOR OFICIAL.** Não há baseline 3D.

Permissão somente para listar, abrir, extrair, pesquisar, comparar arquivos/ZIPs
e calcular hashes no seu ambiente. Proibido executar scripts do projeto, SQL,
migrations, testes, Auth, containers, endpoints, laboratório, acessar o Supabase
remoto ou modificar arquivos do projeto. Os resultados anexos são provas locais,
não reprodução independente pelo auditor.

Examine: kit sugerido ≠ preparado ≠ entrega registrada ≠ confirmação;
solicitação 3C aprovada ≠ entrega. Verifique agrupamento/batch, snapshots,
autorização Gestão e pessoal, RLS, grants e SECURITY DEFINER (owner,
search_path, overloads). Tente encontrar um caminho estático pelo qual o
funcionário crie entrega, João confirme ou divirja de Maria, Maria acesse João,
ou usuário da Gestão sem epi:write prepare, entregue ou trate divergência.
Investigue delivery_id, batch_id, acknowledgement_id, employee_id injetado,
body/URL/querystring manipulados, IDOR, replay, duplo clique, duas abas,
idempotência, confirmação ou divergência duplicada, troca de conta/cache,
funcionário inativo e identidade revogada. Veja se kit preparado vira entrega
sem registro, se entrega/histórico são editáveis, se 3C é concluído sem entrega,
se o EPI anterior fecha cedo e se dados administrativos vazam ao portal.

Para o futuro 3E, avalie suficiência dos snapshots: nome do EPI, CA, quantidade,
unidade, tamanho/variante, horário do servidor, responsável Gestão, grupo,
confirmação e horário, divergências, vínculo com 3C, contexto de eventos fora
do período e reconstrução por data inicial/final. Não implementar PDF.

Produza achados numerados com ID, severidade, estado CONFIRMADO/PARCIAL/
HIPÓTESE/LACUNA DE EVIDÊNCIA/RISCO FUTURO, arquivo/linha, condição,
caminho de falha, evidência, impacto, correção mínima e teste de aceitação.
Distinga leitura estática de reprodução. Diga se há CRÍTICO ou ALTO confirmado
e aberto no escopo local. Não proponha implantação remota ou baseline.
"""
if CYCLE == "2":
    prompt += "\nEste é o segundo e último ciclo. Confronte o parecer do ciclo 1 anexado, as correções e as provas; declare os estados finais e os limites da inspeção passiva.\n"
payload["PROMPT_REVISAO_SOMENTE_LEITURA.md"] = prompt.encode("utf-8")
payload["LEIA-ME.md"] = (f"# Marco 3D — auditoria ciclo {CYCLE}\n\n"
    "SIMULAÇÃO SEM VALOR OFICIAL. Somente laboratório local sintético. "
    "O pacote contém código, SQL, provas, documentação, manifesto e versões "
    "relevantes anteriores. A baseline 3C permanece imutável. Os logs são "
    "evidência local; o auditor não executa o projeto. Sem produção, publicação, "
    "funcionários reais, ponto oficial, REP-P ou Supabase remoto. "
    "Não há baseline 3D; o 3E/PDF não foi iniciado. "
    "O recibo do scan direto do ZIP fica fora dele.\n").encode("utf-8")

files = [{"path": name, "bytes": len(data), "sha256": sha(data)} for name, data in sorted(payload.items())]
delta = [{"path": name, "kind": "novo" if name not in previous_hashes else "alterado",
          "old_sha256": previous_hashes.get(name), "current_sha256": sha(data)}
         for name, data in sorted(payload.items()) if not name.startswith("BASELINE_3C_")
         and previous_hashes.get(name) != sha(data)]
manifest = {
    "id": f"METALLO-3D-AUDITORIA-CICLO{CYCLE}", "is_approved_baseline": False,
    "at": datetime.now(timezone.utc).isoformat(),
    "origin": {"id": ORIGIN_ID, "sha256": ORIGIN_SHA},
    "visual_approval": "responsável aprovou Colaborador e Gestão em 100% e 200%; ordem inferior pedida foi aplicada",
    "mandatory_label": "SIMULAÇÃO SEM VALOR OFICIAL",
    "results": {"3D_Auth_JWT_PostgREST": f"{expected_3d}/{expected_3d}", "3C_prior": "70/70", "3B_prior": "48/48", "3A_prior": "49/49",
                "Web_final": f"{expected_web}/{expected_web}", "banco_final": "31/31", "qualidade_final": "44/44",
                "rede_vigente": "8/8", "TypeScript_lint_build": "aprovados"},
    "overlapping_suites_do_not_sum": True,
    "scope": "auditoria somente leitura de laboratório local; remoto intocado; sem publicação nem baseline 3D",
    "files": files, "inventory_count": len(files), "delta_from_3c": delta,
    "zip_entries": len(files) + 1,
    "secret_scan_receipt": TARGET.relative_to(ROOT).as_posix() + ".verificacao.json",
}
payload["MANIFESTO_SHA256.json"] = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
with zipfile.ZipFile(TARGET, "x", zipfile.ZIP_DEFLATED) as archive:
    for name, data in sorted(payload.items()):
        archive.writestr(name, data)
with zipfile.ZipFile(TARGET) as archive:
    assert len(archive.namelist()) == manifest["zip_entries"]
    assert all(sha(archive.read(row["path"])) == row["sha256"] for row in files)
print(json.dumps({"zip": str(TARGET), "sha256": sha(TARGET.read_bytes()), "entries": manifest["zip_entries"],
                  "delta": len(delta)}, ensure_ascii=False))
