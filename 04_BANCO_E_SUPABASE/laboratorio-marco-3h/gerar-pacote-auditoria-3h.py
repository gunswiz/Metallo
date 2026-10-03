"""Seleção explícita, inventário e secret scan direto dos pacotes de auditoria 3H."""
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
import hashlib
import json
import re
import sys
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[2]
LAB = ROOT / "04_BANCO_E_SUPABASE/laboratorio-marco-3h"
ORIGIN = ROOT / "outputs/Metallo-Marco3G-BaselineAprovada-20260930-R1.zip"
ORIGIN_ID = "METALLO-3G-LAB-20260930-R1"
ORIGIN_SHA = "36d40d4eb85f594b75f904b899b13c02cd3283efa451bb25cdc4ed3c4b00323f"
assert len(sys.argv) == 2 and sys.argv[1] in {"1", "2", "scan1", "scan2", "catalog2"}
ARG = sys.argv[1]
CYCLE = ARG[-1]
TARGET = ROOT / f"outputs/Metallo-Marco3H-Comunicados-Auditoria-20260930-Ciclo{CYCLE}.zip"

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def encoded(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")

def known_credentials():
    values = set()
    def walk(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if isinstance(child, str) and re.search(r"password|senha|token|secret|key", key, re.I) and len(child) >= 12:
                    values.add(child)
                else:
                    walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)
    for path in (ROOT / "backups").glob("credenciais-previa*.json"):
        walk(json.loads(path.read_text(encoding="utf-8-sig")))
    for path in (ROOT / "01_WEB").glob(".env*"):
        if not path.is_file():
            continue
        for line in path.read_text(encoding="utf-8-sig", errors="ignore").splitlines():
            match = re.match(r"\s*(?:export\s+)?([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|KEY)[A-Z0-9_]*)\s*=\s*(.+?)\s*$", line, re.I)
            if match:
                value = match.group(2).strip("\"'")
                if len(value) >= 12:
                    values.add(value)
    return values

PATTERNS = (
    ("JWT literal", r"eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{12,}"),
    ("sb_secret literal", r"sb_secret_[A-Za-z0-9_-]{16,}"),
    ("private key PEM", r"-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----"),
    ("cookie literal", r"(?:Set-Cookie:|Cookie:)\s+[^\r\n]{20,}"),
    ("token literal", r"(?:refresh_token|refreshToken|access_token|accessToken)\s*[=:]\s*[\"'][A-Za-z0-9._-]{24,}[\"']"),
    ("service_role literal", r"(?:SERVICE_ROLE_KEY|service_role_key)\s*[=:]\s*[\"'][A-Za-z0-9._-]{24,}[\"']"),
    ("senha literal", r"(?:password|senha)\s*[=:]\s*[\"'][^\"'\r\n]{12,}[\"']"),
    ("private JWK", r"[\"']d[\"']\s*:\s*[\"'][A-Za-z0-9_-]{32,}[\"']"),
)
FORBIDDEN_PARTS = {"backups", "node_modules", ".git", ".temp", ".next", "cookies", "credentials", "credenciais", "storage", "localstorage", "sessionstorage"}
FORBIDDEN_EXT = (".pem", ".pfx", ".p12", ".key", ".db", ".sqlite", ".dump", ".bak", ".pgdump", ".zip", ".map")

def scan():
    receipt_path = Path(str(TARGET) + ".verificacao.json")
    assert TARGET.is_file() and not receipt_path.exists(), "ZIP ausente ou recibo existente"
    known = known_credentials()
    findings = []
    with zipfile.ZipFile(TARGET) as archive:
        assert archive.testzip() is None
        names = archive.namelist()
        manifest = json.loads(archive.read("MANIFESTO_SHA256.json"))
        assert manifest["id"] == f"METALLO-3H-AUDITORIA-CICLO{CYCLE}"
        assert len(names) == len(set(names)) == manifest["zip_entries"]
        assert set(names) == {r["path"] for r in manifest["files"]} | {"MANIFESTO_SHA256.json"}
        for row in manifest["files"]:
            raw = archive.read(row["path"])
            assert sha(raw) == row["sha256"] and len(raw) == row["bytes"], row["path"]
        for entry in archive.infolist():
            name = entry.filename
            parts = PurePosixPath(name).parts
            if (entry.is_dir() or not parts or name.startswith("/") or ".." in parts or ":" in name or "\\" in name
                or any(p.lower() in FORBIDDEN_PARTS or p.lower().startswith((".env", ".next", "credenciais-previa")) for p in parts)
                or name.lower().endswith(FORBIDDEN_EXT)):
                findings.append({"path": name, "kind": "arquivo/caminho indevido"})
            raw = archive.read(entry)
            content = raw.decode("utf-8-sig", errors="strict")
            for kind, pattern in PATTERNS:
                for match in re.finditer(pattern, content, re.I):
                    findings.append({"path": name, "kind": kind, "match_sha256": sha(match.group().encode())})
            if any(secret in content for secret in known):
                findings.append({"path": name, "kind": "credencial conhecida, valor omitido"})
    receipt = {"at": datetime.now(timezone.utc).isoformat(), "scope": "scan DIRETO de todas as entradas do ZIP final 3H",
        "zip": {"path": TARGET.relative_to(ROOT).as_posix(), "sha256": sha(TARGET.read_bytes()), "entries": len(names)},
        "manifest_and_entry_hashes_verified": True, "known_credentials_compared_in_memory": len(known),
        "values_redacted": True, "findings": findings, "passed": not findings, "is_approved_baseline": False}
    receipt_path.write_bytes(encoded(receipt))
    if findings:
        print(json.dumps({"passed": False, "findings": findings}, ensure_ascii=False))
        sys.exit(1)
    Path(str(TARGET) + ".sha256").write_text(f"{receipt['zip']['sha256']}  {TARGET.name}\n", encoding="ascii")
    print(json.dumps({"passed": True, "zip": str(TARGET), "sha256": receipt["zip"]["sha256"],
        "files": len(manifest["files"]), "entries": len(names), "confirmed_secrets": 0}, ensure_ascii=False))

assert sha(ORIGIN.read_bytes()) == ORIGIN_SHA, "Baseline 3G alterada"
assert not (ROOT / "04_BANCO_E_SUPABASE/laboratorio-marco-1a/supabase/.temp/project-ref").exists(), "Vinculo remoto indevido"
if ARG == "catalog2":
    docker = Path("C:/Program Files/Docker/Docker/resources/bin/docker.exe")
    endpoint = subprocess.check_output([str(docker), "context", "inspect", "--format", "{{.Endpoints.docker.Host}}"], text=True).strip()
    assert endpoint.startswith("npipe:////./pipe/"), "Docker deve ser local"
    before = json.loads((LAB / "catalogo-local-ciclo1.json").read_text(encoding="utf-8-sig"))
    def literal(value):
        return "'" + value.replace("'", "''") + "'"
    function_ids = ",".join(literal(f["signature"]) + "::regprocedure" for f in before["functions"])
    table_ids = ",".join(literal(t["schema"] + "." + t["table"]) + "::regclass" for t in before["tables"])
    query = f"""select jsonb_build_object(
      'at',clock_timestamp(),'scope','catalogo estrutural local; sem linhas de usuarios, tokens ou credenciais',
      'functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),
        'security_definer',p.prosecdef,'settings',p.proconfig,'acl',p.proacl,'definition',pg_get_functiondef(p.oid)) order by p.oid::regprocedure::text)
        from pg_proc p where p.oid in ({function_ids})),
      'tables',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'owner',pg_get_userbyid(c.relowner),
        'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'acl',c.relacl,
        'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,
          'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
        'constraints',(select jsonb_agg(jsonb_build_object('name',k.conname,'definition',pg_get_constraintdef(k.oid))) from pg_constraint k where k.conrelid=c.oid),
        'indexes',(select jsonb_agg(pg_get_indexdef(i.indexrelid)) from pg_index i where i.indrelid=c.oid),
        'triggers',(select jsonb_agg(pg_get_triggerdef(t.oid)) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal),
        'policies',(select jsonb_agg(to_jsonb(q)) from pg_policies q where q.schemaname=n.nspname and q.tablename=c.relname)) order by n.nspname,c.relname)
        from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.oid in ({table_ids})),
      'private_schema_acl',(select nspacl from pg_namespace where nspname='private'))"""
    raw = subprocess.check_output([str(docker), "exec", "supabase_db_laboratorio-marco-1a", "psql", "-X", "-q", "-A", "-t", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", query], text=True, encoding="utf-8")
    catalog = json.loads(raw)
    (LAB / "catalogo-local-ciclo2.json").write_bytes(encoded(catalog))
    print(json.dumps({"functions": len(catalog["functions"]), "tables": len(catalog["tables"]), "user_rows_exported": 0}))
    sys.exit(0)
if ARG.startswith("scan"):
    scan()
    sys.exit(0)
assert not TARGET.exists(), "Não sobrescrever pacote existente"
proof = json.loads((LAB / "resultado-3h.json").read_text(encoding="utf-8-sig"))
assert proof["failed"] == 0 and proof["passed"] == len(proof["checks"]) and all(c["ok"] for c in proof["checks"])
web = json.loads((LAB / "web-completa-3h.json").read_text(encoding="utf-8-sig"))
assert web["success"] and web["numTotalTests"] == web["numPassedTests"] and web["numFailedTests"] == 0
with zipfile.ZipFile(ORIGIN) as archive:
    origin_raw = archive.read("MANIFESTO_SHA256.json")
    origin_manifest = json.loads(origin_raw)
    assert origin_manifest["id"] == ORIGIN_ID
    origin_hashes = {r["path"]: r["sha256"] for r in origin_manifest["files"]}
    assert all(sha(archive.read(path)) == digest for path, digest in origin_hashes.items())

paths = {
    "AGENTS.md", "01_WEB/package.json", "01_WEB/next.config.ts", "01_WEB/proxy.ts",
    "01_WEB/02_COMPONENTES_VISUAIS/sidebar-nav.tsx",
    "01_WEB/03_FUNCOES_E_LOGICA/Autenticacao/session.ts",
    "01_WEB/03_FUNCOES_E_LOGICA/Autenticacao/use-colaborador-session.ts",
    "01_WEB/03_FUNCOES_E_LOGICA/Comunicados/contrato-3h.ts",
    "01_WEB/05_ACESSO_A_DADOS/Supabase/colaborador-local.ts",
    "01_WEB/05_ACESSO_A_DADOS/Supabase/comunicados-3h.ts",
    "01_WEB/05_ACESSO_A_DADOS/Supabase/server.ts",
    "01_WEB/09_CONFIGURACOES/ambienteSupabase.ts", "01_WEB/09_CONFIGURACOES/colaborador-laboratorio.ts",
    "01_WEB/07_ESTILOS/globals.css", "01_WEB/10_TESTES/comunicados-3h.test.tsx",
    "01_WEB/10_TESTES/colaborador-seguranca.test.ts", "01_WEB/10_TESTES/colaborador-preview.test.tsx",
    "01_WEB/app/actions/comunicados-3h.ts", "01_WEB/app/(02_SISTEMA)/comunicados/page.tsx",
    "01_WEB/app/(02_SISTEMA)/comunicados/communication-form.tsx",
    "01_WEB/app/(02_SISTEMA)/comunicados/comunicados.module.css",
    "01_WEB/app/colaborador/[[...screen]]/page.tsx", "01_WEB/app/colaborador/[[...screen]]/colaborador-app.tsx",
    "01_WEB/app/colaborador/[[...screen]]/colaborador.module.css",
    "01_WEB/app/colaborador/[[...screen]]/meus-comunicados.tsx",
    "01_WEB/app/colaborador/[[...screen]]/comunicados.module.css",
    "03_COMPARTILHADO/03_REGRAS_E_PERMISSOES/src/index.ts",
    "04_BANCO_E_SUPABASE/laboratorio-marco-1a/criar-contas-previa-1b.mjs",
    "04_BANCO_E_SUPABASE/laboratorio-marco-1a/historico-remoto/20260831224431_marco3_admin_roles_history_teams.sql",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260925120000_employee_identity_foundation.sql",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260926213000_portal_profile_optional_team.sql",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260927124559_personal_current_work.sql",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3a/contrato-equipe.sql",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3h/contrato-comunicados.sql",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3h/provas-3h.mjs",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3h/resultado-3h.json",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3h/web-completa-3h.json",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3h/catalogo-local-ciclo1.json",
    "04_BANCO_E_SUPABASE/laboratorio-marco-3h/gerar-pacote-auditoria-3h.py",
    "05_DOCUMENTACAO/46_MARCO_3H_COMUNICADOS.md",
}
if CYCLE == "2":
    paths.update({"04_BANCO_E_SUPABASE/laboratorio-marco-3h/parecer-grok-ciclo1-original.md",
        "outputs/Metallo-Marco3H-Comunicados-Auditoria-20260930-Ciclo1.zip.verificacao.json",
        "01_WEB/10_TESTES/comunicados-gestao-3h.test.tsx",
        "01_WEB/02_COMPONENTES_VISUAIS/submit-button.tsx",
        "01_WEB/03_FUNCOES_E_LOGICA/operacoesObra.ts",
        "04_BANCO_E_SUPABASE/supabase/migrations/20260906221331_harden_rpc_and_close_public_signup.sql",
        "04_BANCO_E_SUPABASE/laboratorio-marco-1a/revogar-conta-portal-servidor.mjs",
        "04_BANCO_E_SUPABASE/laboratorio-marco-3h/catalogo-local-ciclo2.json",
        "04_BANCO_E_SUPABASE/laboratorio-marco-3h/build-ciclo2.txt"})
    paths.update(p.relative_to(ROOT).as_posix() for p in LAB.glob("*correc*.sql"))
payload = {name: (ROOT / name).read_bytes() for name in sorted(paths)}
payload["BASELINE_3G_MANIFESTO.json"] = origin_raw
payload["APROVACAO_MANUAL_3H.md"] = ("# Aprovação manual e limites\n\n"
    "O responsável aprovou manualmente o Marco 3H e autorizou auditoria independente em 30/09/2026. "
    "A aprovação preserva 58/58 reais e 217/217 Web, TypeScript/lint/build aprovados e loopback. "
    "Não atribuir à automação provas móveis/teclado além das descritas no documento 46. "
    "Máximo dois ciclos Grok; não é autorização de baseline, remoto, publicação ou Marco 3I.\n").encode()
payload["RESULTADOS_3H.json"] = encoded({"scope": "laboratório sintético", "real_auth_rpc": f"{proof['passed']}/{len(proof['checks'])}",
    "web": f"{web['numPassedTests']}/{web['numTotalTests']}", "typescript": "aprovado", "lint": "aprovado", "build": "aprovado",
    "quality_source": "documento 46: gates pre-auditoria no ciclo 1; repetidos apos correcao no ciclo 2",
    "web_full_report_included": True, "overlapping_suites_do_not_sum": True, "manual_approval": True})
prompt = f"""# Auditoria adversarial independente — Marco 3H, ciclo {CYCLE}

SIMULAÇÃO SEM VALOR OFICIAL. Somente laboratório sintético, sem baseline 3H.
Verifique o ZIP integralmente, inventário e hashes. Origem {ORIGIN_ID}, SHA-256
{ORIGIN_SHA}. Só o manifesto da origem está anexado: não afirme ter recomputado
seu ZIP. Avaliação manual aprovada. Gates locais constam dos resultados integrais,
não representam execução independente sua. Suítes sobrepostas não se somam.

Você é AUDITOR, não desenvolvedor. Somente inspeção PASSIVA no seu ambiente:
listar, ler, extrair ZIP, pesquisar texto, comparar, calcular hashes. PROIBIDO
executar projeto/scripts/testes, SQL/migrations, banco, Auth, containers, endpoints,
localhost/rede do projeto, usar credenciais, acessar sessão do navegador, modificar
arquivos do projeto ou Supabase remoto. Não procure endpoints externos.

Audite cada RPC/SECURITY DEFINER: auth.uid(), search_path, owner, EXECUTE, RLS/bypass,
parâmetros, escalada. Tabelas privadas, revisões e visualizações devem negar acesso
direto ao cliente. Separe ator Gestão/admin ativo de perfil do portal/inativo.
João/Maria: TODOS, equipe e obra, ID direto, rascunho, expirado, arquivado, revisão,
visualização alheia; injection communication_id/employee_id/team_id/work_id/target_id/
view_id, URL/query/body/RPC. NULL não amplia públicos específicos. Funcionário ativo
sem equipe/obra recebe TODOS. Contexto ATUAL precisa concordar com 1C/3A e docs.

Examine troca de conta, logout, duas abas, contador não lido, React/server cache e
respostas atrasadas. Listar não registra abertura. Primeira abertura idempotente;
uma conta não marca outra como lida. Visualizado não é assinatura/concordância/
ciência trabalhista formal; ausência de passkey/3F, PDFs/anexos/storage/push externo.
Expiração pelo servidor; fixação não contorna autorização; archive preserva histórico;
correção tem updated_at/by, versão e snapshots anteriores; abertura concorrente com
correção, archive/expiração/revogação/mudança de público. Não exija sistema jurídico.

XSS/HTML/SVG/event handlers/javascript/URLs/Unicode/multilinha/limites/paginação,
foco/teclado/200%/viewport estreita; N+1, contadores e públicos atuais, admin inativo,
duplo clique/retry/timeout/criação e publicação. Não confunda HTML escapado com execução
nem valores sintéticos com segredos. Não trate acesso de postgres/administrador do host
como bypass do portal sem condição real. Examine vazamento de SQL/stack/dados/IDs.

Entregue TODOS os achados numerados F-3H-XX. Para cada: ID, severidade, estado
CONFIRMADO/PARCIAL/HIPÓTESE/LACUNA DE EVIDÊNCIA/RISCO FUTURO, arquivo/linha, condição,
caminho de falha/exploração, evidência, impacto, correção mínima e teste de aceitação.
Declare separadamente CRÍTICO/ALTO confirmado e aberto no escopo local, médios/baixos
e riscos futuros. Não transformar hipótese/lacuna em vulnerabilidade comprovada.
Informe o que inspecionou e quais comandos passivos usou, sem executar o projeto.
Não autorize baseline, publicação, produção, remoto, funcionários reais ou REP-P.
"""
if CYCLE == "2":
    prompt += "\nSEGUNDO E ÚLTIMO CICLO. Confronte as correções/evidências e cada achado do ciclo 1, usando a matriz do documento 46. Procure regressões e críticos/altos confirmados abertos; não solicite terceiro ciclo.\n"
payload["PROMPT_REVISAO_SOMENTE_LEITURA.md"] = prompt.encode()
payload["LEIA-ME.md"] = ("# Marco 3H — pacote sanitizado de auditoria passiva\n\n"
    "Seleção deliberada de fontes pertinentes e dependências de autorização; não é checkout "
    "executável, backup ou baseline. Não contém contas, credenciais, dumps, storage ou dados reais. "
    "Revisões append-only através das RPCs e grants; não é prova contra postgres/host privilegiado. "
    "Fonte SQL é local; catálogo exporta somente estrutura, owners/grants/policies. Fontes de módulos "
    "anteriores são contexto, não ampliação do escopo. Recibo de scan e SHA do ZIP são externos "
    "para evitar autorreferência. SIMULAÇÃO SEM VALOR OFICIAL.\n").encode()
payload["INVENTARIO_3H.json"] = encoded([{"path": name, "purpose": "fonte/teste/contrato relevante" if name.startswith(("01_WEB/", "03_COMPARTILHADO/", "04_BANCO_E_SUPABASE/")) else "governanca/evidencia/instrucao"} for name in sorted(payload)])
files = [{"path": name, "bytes": len(raw), "sha256": sha(raw)} for name, raw in sorted(payload.items())]
manifest = {"id": f"METALLO-3H-AUDITORIA-CICLO{CYCLE}", "at": datetime.now(timezone.utc).isoformat(),
    "is_approved_baseline": False, "mandatory_label": "SIMULAÇÃO SEM VALOR OFICIAL",
    "origin": {"id": ORIGIN_ID, "sha256": ORIGIN_SHA, "manifest_sha256": sha(origin_raw), "origin_zip_included": False},
    "files": files, "inventory_count": len(files), "zip_entries": len(files) + 1,
    "delta_from_3g": [{"path": name, "origin_sha256": origin_hashes.get(name), "current_sha256": sha(raw),
        "comparison": "different" if name in origin_hashes else "not_in_direct_origin_inventory"}
        for name, raw in sorted(payload.items()) if not name.startswith("BASELINE_") and origin_hashes.get(name) != sha(raw)],
    "limits": ["laboratorio sintetico", "remoto intocado", "sem baseline 3H", "sem publicacao", "sem Marco 3I"],
    "secret_scan_receipt": TARGET.relative_to(ROOT).as_posix() + ".verificacao.json"}
payload["MANIFESTO_SHA256.json"] = encoded(manifest)
with zipfile.ZipFile(TARGET, "x", zipfile.ZIP_DEFLATED) as archive:
    for name, raw in sorted(payload.items()):
        archive.writestr(name, raw)
print(json.dumps({"zip": str(TARGET), "sha256": sha(TARGET.read_bytes()), "files": len(files),
    "entries": len(payload), "baseline_created": False}, ensure_ascii=False))
