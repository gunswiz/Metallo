"""Gera e verifica o pacote de auditoria passiva do Marco 3G."""

from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
import hashlib
import json
import re
import sys
import zipfile


ROOT = Path(__file__).resolve().parents[2]
LAB = ROOT / "04_BANCO_E_SUPABASE/laboratorio-marco-3g"
ORIGIN_ID = "METALLO-3F-LAB-20260929-R1"
ORIGIN_SHA = "76e964041e3f4a06ce4c11cc0fdc58fa8a3429bb68d8db2a4a248918356ea3d4"
ORIGIN = ROOT / "outputs/Metallo-Marco3F-BaselineAprovada-20260929-R1.zip"
assert len(sys.argv) == 2 and sys.argv[1] in {"1", "2", "scan1", "scan2"}
ARG = sys.argv[1]
CYCLE = ARG[-1]
TARGET = ROOT / f"outputs/Metallo-Marco3G-ItensPessoais-Auditoria-20260930-Ciclo{CYCLE}.zip"


def sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def read(name: str) -> bytes:
    return (ROOT / name).read_bytes()


def known_local_secrets() -> set[str]:
    """Lê segredos somente em memória para comparação; nunca os grava no recibo."""
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
    ("chave privada JWK", r"[\"']d[\"']\s*:\s*[\"'][A-Za-z0-9_-]{32,}[\"']"),
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
        assert manifest["id"] == f"METALLO-3G-AUDITORIA-CICLO{CYCLE}"
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
            content = archive.read(entry).decode("utf-8-sig", errors="ignore")
            for kind, pattern in PATTERNS:
                for match in re.finditer(pattern, content, re.I):
                    findings.append({"path": name, "kind": kind, "match_sha256": sha(match.group().encode())})
            if any(secret in content for secret in known):
                findings.append({"path": name, "kind": "credencial local conhecida"})
    receipt = {
        "at": datetime.now(timezone.utc).isoformat(),
        "scope": "scan direto de cada entrada do ZIP final 3G",
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


assert sha(ORIGIN.read_bytes()) == ORIGIN_SHA, "Baseline 3F alterada"
assert not (ROOT / "04_BANCO_E_SUPABASE/laboratorio-marco-1a/supabase/.temp/project-ref").exists(), "Laboratório ligado ao remoto"
if ARG.startswith("scan"):
    scan_zip()
    sys.exit(0)

assert not TARGET.exists(), "Pacote existente; não sobrescrever"
for filename, expected in (("resultado-3g.json", 34), ("resultado-estoque-3g.json", 40)):
    result = json.loads((LAB / filename).read_text(encoding="utf-8-sig"))
    assert result["passed"] == result["total"] == expected and len(result["checks"]) == expected
    assert all(row["ok"] for row in result["checks"])
web = json.loads((LAB / "web-completa-3g.json").read_text(encoding="utf-8-sig"))
assert web["success"] and web["numTotalTests"] == web["numPassedTests"] == 209 and web["numFailedTests"] == 0
with zipfile.ZipFile(ORIGIN) as archive:
    origin_manifest_raw = archive.read("MANIFESTO_SHA256.json")
    origin_manifest = json.loads(origin_manifest_raw)
    assert origin_manifest["id"] == ORIGIN_ID
    origin_hashes = {row["path"]: row["sha256"] for row in origin_manifest["files"]}
    assert all(sha(archive.read(path)) == hash_value for path, hash_value in origin_hashes.items())

paths = {
    "AGENTS.md", "01_WEB/package.json", "01_WEB/proxy.ts",
    "01_WEB/02_COMPONENTES_VISUAIS/entrega-item-pessoal-3g.tsx",
    "01_WEB/02_COMPONENTES_VISUAIS/error-panel.tsx",
    "01_WEB/03_FUNCOES_E_LOGICA/Autenticacao/session.ts",
    "01_WEB/03_FUNCOES_E_LOGICA/Autenticacao/use-colaborador-session.ts",
    "01_WEB/03_FUNCOES_E_LOGICA/Erros/app-error.ts",
    "01_WEB/03_FUNCOES_E_LOGICA/ItensPessoais/contrato-3g.ts",
    "01_WEB/03_FUNCOES_E_LOGICA/operacoesObra.ts",
    "01_WEB/05_ACESSO_A_DADOS/Repositorios/metallo-repository.ts",
    "01_WEB/05_ACESSO_A_DADOS/Supabase/colaborador-local.ts",
    "01_WEB/05_ACESSO_A_DADOS/Supabase/itens-pessoais-3g.ts",
    "01_WEB/05_ACESSO_A_DADOS/Supabase/server.ts",
    "01_WEB/07_ESTILOS/globals.css",
    "01_WEB/10_TESTES/colaborador-itens-3g.test.tsx",
    "01_WEB/10_TESTES/gestao-funcionarios-3g.test.ts",
    "01_WEB/10_TESTES/itens-pessoais-estoque-3g.test.tsx",
    "01_WEB/app/(02_SISTEMA)/epis/[id]/page.tsx",
    "01_WEB/app/(02_SISTEMA)/epis/entrega/page.tsx",
    "01_WEB/app/(02_SISTEMA)/ferramentas/atribuicoes/page.tsx",
    "01_WEB/app/(02_SISTEMA)/ferramentas/page.tsx",
    "01_WEB/app/(02_SISTEMA)/funcionarios/[id]/itens/page.tsx",
    "01_WEB/app/(02_SISTEMA)/funcionarios/[id]/page.tsx",
    "01_WEB/app/(02_SISTEMA)/funcionarios/page.tsx",
    "01_WEB/app/actions/itens-pessoais-3g.ts",
    "01_WEB/app/colaborador/[[...screen]]/colaborador-app.tsx",
    "01_WEB/app/colaborador/[[...screen]]/colaborador.module.css",
    "01_WEB/app/colaborador/[[...screen]]/meus-itens.tsx",
    "04_BANCO_E_SUPABASE/laboratorio-marco-1a/historico-remoto/20260831224431_marco3_admin_roles_history_teams.sql",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3g/contrato-itens-pessoais.sql",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3g/endurecimento-excecao-3g.sql",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3g/integracao-estoque-3g.sql",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3g/provas-3g.mjs",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3g/provas-estoque-3g.mjs",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3g/resultado-3g.json",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3g/resultado-estoque-3g.json",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3g/web-completa-3g.json",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260906221331_harden_rpc_and_close_public_signup.sql",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260925120000_employee_identity_foundation.sql",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260926213000_portal_profile_optional_team.sql",
    "05_DOCUMENTACAO/45_MARCO_3G_MEUS_ITENS_PESSOAIS.md",
}
if CYCLE == "2":
    paths.update({
        "04_BANCO_E_SUPABASE/laboratorio-marco-3g/parecer-grok-ciclo1-original.md",
        "04_BANCO_E_SUPABASE/laboratorio-marco-3g/catalogo-local-ciclo1.txt",
        "04_BANCO_E_SUPABASE/laboratorio-marco-3g/gerar-pacote-auditoria-3g.py",
        "outputs/Metallo-Marco3G-ItensPessoais-Auditoria-20260930-Ciclo1.zip.verificacao.json",
        "01_WEB/02_COMPONENTES_VISUAIS/formulario-operacao.tsx",
        "01_WEB/03_FUNCOES_E_LOGICA/executarOperacaoValidada.ts",
        "01_WEB/03_FUNCOES_E_LOGICA/Relatorios/epi-report-3e.ts",
        "01_WEB/03_FUNCOES_E_LOGICA/Relatorios/epi-report-3e-pdf.ts",
        "04_BANCO_E_SUPABASE/laboratorio-marco-3c/contrato-troca-epi.sql",
        "04_BANCO_E_SUPABASE/laboratorio-marco-3d/contrato-entrega-confirmacao.sql",
        "04_BANCO_E_SUPABASE/laboratorio-marco-3e/contrato-ficha-historico.sql",
        "04_BANCO_E_SUPABASE/supabase/migrations/20260902231312_epi_management.sql",
        "04_BANCO_E_SUPABASE/supabase/migrations/20260912073507_user_operation_permissions.sql",
        "04_BANCO_E_SUPABASE/supabase/migrations/20260912073518_site_operations.sql",
        "04_BANCO_E_SUPABASE/supabase/migrations/20260926224000_unassigned_employee_management_scope.sql",
        "05_DOCUMENTACAO/41_MARCO_3C_SOLICITAR_TROCA_EPI.md",
        "05_DOCUMENTACAO/42_MARCO_3D_ENTREGA_CONFIRMACAO_EPI.md",
        "05_DOCUMENTACAO/43_MARCO_3E_FICHA_HISTORICO_EPI_PDF.md",
    })
payload = {name: read(name) for name in sorted(paths)}
payload["BASELINE_3F_MANIFESTO.json"] = origin_manifest_raw
payload["APROVACAO_MANUAL_3G.md"] = ("# Aprovação manual do Marco 3G\n\n"
    "O responsável aprovou acesso à aba Funcionários, correção do antigo estado ‘Sem conexão’, "
    "funcionários sem equipe, itens pessoais, entrega normal e excepcional, lote/estoque, "
    "justificativa, devolução e destino, layout responsivo, selects, botão de encerramento "
    "e ausência de sobreposição em largura reduzida. Esta aprovação autoriza auditoria passiva; "
    "não autoriza baseline, publicação ou Supabase remoto.\n").encode("utf-8")
payload["RESULTADOS_3G.json"] = (json.dumps({
    "scope": "laboratório sintético 3G", "contract": "34/34", "stock_and_exception": "40/40",
    "web": "209/209", "typescript": "aprovado", "lint": "aprovado", "build": "aprovado",
    "overlapping_suites_do_not_sum": True,
    "manual_approval": "aprovada pelo responsável",
    "audit": "pendente no instante da geração", "baseline_3g": False,
}, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
prompt = f"""# Auditoria adversarial independente — Marco 3G, ciclo {CYCLE}

Inspecione integralmente o ZIP anexado, seu manifesto e hashes de cada entrada.
Origem imutável: {ORIGIN_ID}, SHA-256 {ORIGIN_SHA}; o manifesto da origem está
incluído, mas não seu ZIP: não afirme ter recomputado o hash da origem.
SIMULAÇÃO SEM VALOR OFICIAL. Só laboratório sintético, sem baseline 3G. O responsável
aprovou manualmente as telas. Provas locais: 34/34 contrato, 40/40 estoque/exceção,
209/209 Web, TypeScript, lint e build aprovados. Essas suítes se sobrepõem e não
constituem execução independente sua.

Você é AUDITOR, não desenvolvedor. Permita apenas inspeção passiva no SEU ambiente:
listar, abrir, extrair ZIP, pesquisar texto, comparar e calcular hashes. É proibido
executar scripts do projeto, SQL, migrations, testes, Auth, containers, endpoints,
localhost ou rede do laboratório; modificar projeto ou acessar Supabase remoto.

Examine adversarialmente, com prioridade: transação única ENTREGA+BAIXA, rollback
em qualquer falha, timeout, retry, conexão interrompida e concorrência (saldo 1,
João e Maria disputando); saldo nunca negativo; idempotência em duplo clique,
duas abas, HTTP retry e mesmo operation ID; isolamento João/Maria e manipulação
de employee_id, batch_id, delivery_id, personal_item_id, URL/body/query/RPC.

Verifique existência, atividade, saldo, tipo e contexto do lote; ausência de
estoque paralelo; exceção sem estoque somente para admin global ativo com motivo
validado no servidor, observação obrigatória para OUTRO e confirmação explícita;
responsável derivado da sessão; exceção sem movimento de estoque; legado sem baixa
retroativa; retorno reutilizável exatamente ao lote original após mudança de
equipe/obra, inclusive lote inativo; dano/extravio sem reposição; encerramento
imutável e devolução idempotente. Verifique que troca 3C não baixa no pedido nem
na aprovação, e que 3G não reescreve entregas 3D, confirmação ou PDF 3E.

Examine funcionário sem equipe e limites de escopo, estados de erro da UI sem
vazamento, responsividade sem sobreposição, remoção de assinatura RPC antiga,
grants mínimos, RLS, cada SECURITY DEFINER (search_path, auth.uid(), owner,
parâmetros e bypass), autorização por sessão em vez de parâmetros/claims de cliente,
perfil admin inativo, append-only, timestamps e contexto auditável. Trate João,
Maria, estoques e contas como massa sintética.

Produza TODOS os achados numerados F-3G-XX. Para cada: ID, severidade, estado
CONFIRMADO/PARCIAL/HIPÓTESE/LACUNA DE EVIDÊNCIA/RISCO FUTURO, arquivo e linha,
condição necessária, caminho da falha, evidência, impacto, correção mínima e teste
de aceitação. Distinga hipótese de falha comprovada. Declare CRÍTICO/ALTO confirmado
e aberto no escopo local, e riscos médios/baixos. Não aprove baseline, produção,
remoto, publicação, ponto oficial ou REP-P.
"""
if CYCLE == "2":
    prompt += ("\nSEGUNDO E ÚLTIMO CICLO: o parecer original e a matriz de confronto dos 15 "
               "achados F-3G-01 a F-3G-15 estão na documentação 45 do pacote. Não houve "
               "correção de código/SQL depois do ciclo 1: este ciclo amplia as evidências "
               "estruturais e fontes antes ausentes. Confira o catálogo local, as policies "
               "de epi_employees e epi_stock_batches, a constraint quantity>=0, os grants "
               "e owners, os fontes 3C/3D/3E e os hashes contra a baseline 3F. O scan direto "
               "do ZIP ciclo 1 está anexado; o recibo do próprio ciclo 2 é externo ao ZIP "
               "para evitar autorreferência e seu SHA será informado no envio. Reavalie cada "
               "achado, diferencie risco de política empresarial de bypass confirmado e "
               "declare qualquer CRÍTICO/ALTO confirmado e aberto. Não solicite ciclo 3.\n")
payload["PROMPT_REVISAO_SOMENTE_LEITURA.md"] = prompt.encode("utf-8")
payload["LEIA-ME.md"] = (f"# Marco 3G — auditoria passiva ciclo {CYCLE}\n\n"
    "SIMULAÇÃO SEM VALOR OFICIAL. Seleção de código, SQL, testes e documentação para revisão "
    "estática; não é checkout executável nem backup. Baseline 3F intacta. Sem baseline 3G, "
    "Supabase remoto, produção, funcionários reais, publicação, ponto oficial ou REP-P. "
    "O recibo externo registra o SHA do ZIP e o scan direto.\n").encode("utf-8")
inventory = [{"path": name, "purpose": ("código ou teste" if name.startswith("01_WEB/") else
              "contrato SQL ou prova local" if name.startswith("04_BANCO_E_SUPABASE/") else
              "documentação ou governança" if name.startswith("05_DOCUMENTACAO/") or name == "AGENTS.md" else
              "evidência e instrução de auditoria")}
             for name in sorted(payload)]
payload["INVENTARIO_3G.json"] = (json.dumps(inventory, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
files = [{"path": name, "bytes": len(raw), "sha256": sha(raw)} for name, raw in sorted(payload.items())]
manifest = {
    "id": f"METALLO-3G-AUDITORIA-CICLO{CYCLE}", "is_approved_baseline": False,
    "at": datetime.now(timezone.utc).isoformat(), "mandatory_label": "SIMULAÇÃO SEM VALOR OFICIAL",
    "origin": {"id": ORIGIN_ID, "sha256": ORIGIN_SHA, "manifest_sha256": sha(origin_manifest_raw),
               "all_origin_entry_hashes_verified_locally": True, "full_origin_zip_included": False},
    "results": {"contract": "34/34", "stock_and_exception": "40/40", "web": "209/209",
                "TypeScript": "pass", "lint": "pass", "build": "pass", "overlapping_suites_do_not_sum": True},
    "limits": ["laboratório sintético", "Supabase remoto intocado", "sem funcionários reais", "sem publicação",
               "sem baseline 3G", "não é produção, ponto oficial ou REP-P"],
    "files": files, "inventory_count": len(files), "zip_entries": len(files) + 1,
    "delta_from_3f": [{"path": name, "kind": "changed" if name in origin_hashes else "new",
                       "origin_sha256": origin_hashes.get(name), "current_sha256": sha(raw)}
                      for name, raw in sorted(payload.items()) if not name.startswith("BASELINE_3F_")
                      and origin_hashes.get(name) != sha(raw)],
    "secret_scan_receipt": TARGET.relative_to(ROOT).as_posix() + ".verificacao.json",
}
payload["MANIFESTO_SHA256.json"] = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
with zipfile.ZipFile(TARGET, "x", zipfile.ZIP_DEFLATED) as archive:
    for name, raw in sorted(payload.items()):
        archive.writestr(name, raw)
print(json.dumps({"zip": str(TARGET), "sha256": sha(TARGET.read_bytes()), "files": len(files),
                  "entries": len(payload), "delta": len(manifest["delta_from_3f"]), "baseline_created": False}, ensure_ascii=False))
