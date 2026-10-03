"""Empacota revisão ou baseline 2E e exige scan direto do ZIP final."""
from pathlib import Path
import datetime
import hashlib
import json
import os
import re
import subprocess
import sys
import zipfile

root = Path(__file__).resolve().parents[2]
assert len(sys.argv) in (2, 3), "Uso: gerar-pacote-auditoria-2e.py 1|2|baseline [--dry-run]"
mode = sys.argv[1]
assert mode in ("1", "2", "baseline")
dry_run = len(sys.argv) == 3 and sys.argv[2] == "--dry-run"
assert len(sys.argv) == 2 or dry_run
baseline = mode == "baseline"
archive_name = ("Metallo-Marco2E-BaselineAprovada-20260927-R1.zip" if baseline else
                f"Metallo-Marco2E-Revogacao-Auditoria-20260927-Ciclo{mode}.zip")
baseline_id = "METALLO-2E-LAB-20260927-R1" if baseline else f"METALLO-2E-AUDITORIA-CICLO{mode}"
target = root / "outputs" / archive_name
receipt_path = Path(str(target) + ".verificacao.json")
for destination in (target, Path(str(target) + ".sha256"), receipt_path):
    assert not destination.exists(), f"Destino existente: {destination.name}"

sha = lambda data: hashlib.sha256(data).hexdigest()
origin_path = root / "outputs/Metallo-Marco2D-BaselineAprovada-20260927-R1.zip"
origin_sha = "15d5e791c3237f8c7c98d316ddef7220c256ddc8b5b011f9c289741ab1691dd3"
assert sha(origin_path.read_bytes()) == origin_sha
assert not (root / "04_BANCO_E_SUPABASE/laboratorio-marco-1a/supabase/.temp/project-ref").exists()
with zipfile.ZipFile(origin_path) as source:
    old_manifest = json.loads(source.read("MANIFESTO_SHA256.json"))
    old_files = {item["path"]: item["sha256"] for item in old_manifest["files"]}

listed = [
    "AGENTS.md",
    "05_DOCUMENTACAO/22_AMBIENTE_REP_P_E_ROADMAP.md",
    "05_DOCUMENTACAO/35_MARCO_2C_REVOGACAO_RECUPERACAO_RESILIENCIA.md",
    "05_DOCUMENTACAO/36_MARCO_2D_RECUPERACAO_LOCAL_E_INTEGRIDADE.md",
    "05_DOCUMENTACAO/37_MARCO_2E_REVOGACAO_SESSOES_TOKEN_RESIDUAL.md",
    "04_BANCO_E_SUPABASE/laboratorio-marco-1a/criar-contas-previa-1b.mjs",
    "04_BANCO_E_SUPABASE/laboratorio-marco-1a/revogar-conta-portal-servidor.mjs",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260925120000_employee_identity_foundation.sql",
    "04_BANCO_E_SUPABASE/supabase/migrations/20260926213000_portal_profile_optional_team.sql",
    "04_BANCO_E_SUPABASE/laboratorio-marco-2b/auth-local.mjs",
    "04_BANCO_E_SUPABASE/laboratorio-marco-2b/autorizacao.mjs",
    "04_BANCO_E_SUPABASE/laboratorio-marco-2b/backup.mjs",
    "04_BANCO_E_SUPABASE/laboratorio-marco-2b/http-lab.mjs",
    "04_BANCO_E_SUPABASE/laboratorio-marco-2b/integridade.mjs",
    "04_BANCO_E_SUPABASE/laboratorio-marco-2b/nucleo.mjs",
    "04_BANCO_E_SUPABASE/laboratorio-marco-2b/recuperacao.mjs",
    "04_BANCO_E_SUPABASE/laboratorio-marco-2b/schema.sql",
    "04_BANCO_E_SUPABASE/laboratorio-marco-2b/sessao-local-2e.sql",
    "04_BANCO_E_SUPABASE/laboratorio-marco-2b/provas-2b.mjs",
    "04_BANCO_E_SUPABASE/laboratorio-marco-2b/provas-transporte-2b.mjs",
    "04_BANCO_E_SUPABASE/laboratorio-marco-2b/provas-revogacao-concorrente-2b.mjs",
    "04_BANCO_E_SUPABASE/laboratorio-marco-2d/processo-ensaio.mjs",
    "04_BANCO_E_SUPABASE/laboratorio-marco-2d/provas-2d.mjs",
    "04_BANCO_E_SUPABASE/laboratorio-marco-2d/provas-auth-real-2d.mjs",
    "04_BANCO_E_SUPABASE/laboratorio-marco-2d/plano-testes-2d.json",
    "04_BANCO_E_SUPABASE/laboratorio-marco-2d/plano-auth-real-2d.json",
    "04_BANCO_E_SUPABASE/laboratorio-marco-2d/verificar-segredos-2d.mjs",
    "01_WEB/03_FUNCOES_E_LOGICA/Autenticacao/use-colaborador-session.ts",
    "01_WEB/05_ACESSO_A_DADOS/Ponto/ponto-lab.ts",
    "01_WEB/05_ACESSO_A_DADOS/Supabase/colaborador-local.ts",
    "01_WEB/app/api/ponto-lab/[...path]/route.ts",
    "01_WEB/app/colaborador/[[...screen]]/page.tsx",
    "01_WEB/app/colaborador/[[...screen]]/colaborador-app.tsx",
    "01_WEB/app/colaborador/[[...screen]]/colaborador.module.css",
    "01_WEB/app/colaborador/[[...screen]]/meu-ponto.tsx",
    "01_WEB/10_TESTES/colaborador-preview.test.tsx",
    "01_WEB/10_TESTES/colaborador-ponto.test.tsx",
    "01_WEB/10_TESTES/colaborador-seguranca.test.ts",
]
evidence = root / "04_BANCO_E_SUPABASE/laboratorio-marco-2e"
listed += [p.relative_to(root).as_posix() for p in evidence.iterdir() if p.is_file() and p.suffix in (".mjs", ".py", ".json", ".log")]
if mode in ("2", "baseline"):
    listed.append("04_BANCO_E_SUPABASE/laboratorio-marco-2e/parecer-grok-ciclo1.md")
    listed.append("outputs/Metallo-Marco2E-Revogacao-Auditoria-20260927-Ciclo1.zip.verificacao.json")
if baseline:
    listed.append("04_BANCO_E_SUPABASE/laboratorio-marco-2e/parecer-grok-ciclo2.md")
    listed.append("outputs/Metallo-Marco2E-Revogacao-Auditoria-20260927-Ciclo2.zip.verificacao.json")
paths = sorted(set(listed))
payload = {}
for relative_name in paths:
    p = Path(relative_name)
    assert not p.is_absolute() and ".." not in p.parts and not any(part in {"backups", "node_modules", ".git", ".temp"} or part.startswith(".env") for part in p.parts)
    assert not any(part.lower().endswith((".pem", ".pfx", ".p12", ".key", ".sqlite", ".db")) or part.lower() in {"cookies", "credentials", "credenciais"} for part in p.parts)
    full = root / p
    assert full.is_file(), relative_name
    payload[p.as_posix()] = full.read_bytes()
payload["BASELINE_2D_MANIFESTO.json"] = (json.dumps(old_manifest, ensure_ascii=False, indent=2) + "\n").encode()
payload["LEIA-ME.md"] = f"""# {baseline_id}

**SIMULAÇÃO SEM VALOR OFICIAL.** {'Baseline aprovada do Marco 2E em laboratório sintético' if baseline else 'Pacote de revisão passiva, sem baseline aprovada'}. Não é distribuição, produção, ponto oficial, REP-P ou autorização de publicação.

Origem imutável METALLO-2D-LAB-20260927-R1; SHA-256 {origin_sha}. O manifesto da origem está incluído para conferir o delta, mas o ZIP de origem não está reproduzido. Leia primeiro 05_DOCUMENTACAO/37_MARCO_2E_REVOGACAO_SESSOES_TOKEN_RESIDUAL.md e MANIFESTO_SHA256.json.

Os dois pareceres Grok e o confronto estão documentados no arquivo 37. O auditor usou somente inspeção passiva: listagem, extração, leitura, busca e hashes; não executou projeto, scripts, SQL, migrations, testes, Auth, containers, endpoints, rede do laboratório ou Supabase remoto. Resultados registrados são provas locais, não testes reexecutados pelo auditor.

O recibo externo exato é outputs/{receipt_path.name}. Ele é gerado após o ZIP e deve conter o SHA-256 do próprio ZIP, passed=true e findings=[]. Fica fora do ZIP para evitar autorreferência. Não há credenciais, banco Auth, banco PGlite ativo, cookies, dados reais ou arquivos .env no pacote.
""".encode()

counts = {
    "resultado-2e.json": 33 if mode == "1" else 34,
    "resultado-2d-regressao.json": 49,
    "resultado-2b-regressao.json": 64,
    "resultado-auth-real-2d-regressao.json": 17,
    "resultado-transporte-2b.json": 13,
    "resultado-revogacao-concorrente-2b.json": 5,
    "resultado-1c-regressao.json": 45,
    "rede.json": 8,
}
results = {}
for file, expected in counts.items():
    report = json.loads((evidence / file).read_text(encoding="utf-8-sig"))
    assert report.get("passed") is True and len(report["checks"]) == expected and all(x["ok"] for x in report["checks"]), file
    results[file] = f"{expected}/{expected}"
web = (evidence / "web.log").read_text(encoding="utf-8-sig")
assert "117 passed" in web and "failed" not in web.lower()
results["web"] = "117/117"
for file, expected in (("banco.log", 31), ("qualidade.log", 44)):
    log = (evidence / file).read_text(encoding="utf-8-sig")
    assert re.search(rf"\bpass {expected}\b", log) and re.search(r"\bfail 0\b", log), file
    results[file] = f"{expected}/{expected}"
for file in ("typecheck.log", "lint.log", "build.log"):
    assert (evidence / file).read_text(encoding="utf-8-sig").strip(), file
    results[file] = "aprovado"
scan = json.loads((evidence / "resultado-segredos-2e.json").read_text())
assert scan["passed"] and scan["findings"] == []
assert f"{counts['resultado-2e.json']}/{counts['resultado-2e.json']}" in (root / "05_DOCUMENTACAO/37_MARCO_2E_REVOGACAO_SESSOES_TOKEN_RESIDUAL.md").read_text(encoding="utf-8")
historical = json.loads((evidence / "base-real.json").read_text())
assert len(historical["checks"]) == 683 and all(item["ok"] for item in historical["checks"])
assert json.loads((evidence / "resultado-t15-after.json").read_text())["passed"] is True
results["base_historica"] = "683/683 — ver base-real.json e resultado-t15-after.json"

files = [{"path": n, "bytes": len(b), "sha256": sha(b)} for n, b in sorted(payload.items())]
delta = [{"path": n, "kind": "novo" if n not in old_files else "alterado", "old_sha256": old_files.get(n), "current_sha256": sha(b)} for n, b in sorted(payload.items()) if n not in old_files or old_files[n] != sha(b)]
manifest = {
    "id": baseline_id,
    "is_approved_baseline": baseline,
    "formal_approval": "Responsável autorizou expressamente o fechamento técnico e a baseline 2E após saneamento F2E-08" if baseline else None,
    "at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "origin": {"id": "METALLO-2D-LAB-20260927-R1", "sha256": origin_sha},
    "protected_archives": [
        {"path": "outputs/Metallo-Marco2E-Revogacao-Auditoria-20260927-Ciclo2.zip", "sha256": "2eb9dea5e270d86f891190de3e9f7b8c91b803eae84bb59cb90defc5528ad451"},
    ] if baseline else [],
    "visual_approval": "Responsável confirmou aprovação em 100% e 200% na conversa Codex em 27/09/2026",
    "mandatory_label": "SIMULAÇÃO SEM VALOR OFICIAL",
    "results": results,
    "overlapping_suites_do_not_sum": True,
    "scope": "exclusivamente local e sintético; remoto intocado; sem publicação",
    "audit_mode": "dois ciclos Grok passivos concluídos e confrontados; sem terceiro ciclo" if baseline else "somente inspeção passiva; proibida execução do projeto, SQL, Auth, rede e mudanças",
    "independent_audits": ([
        {"cycle": 1, "path": "04_BANCO_E_SUPABASE/laboratorio-marco-2e/parecer-grok-ciclo1.md", "sha256": sha((evidence / "parecer-grok-ciclo1.md").read_bytes())},
        {"cycle": 2, "path": "04_BANCO_E_SUPABASE/laboratorio-marco-2e/parecer-grok-ciclo2.md", "sha256": sha((evidence / "parecer-grok-ciclo2.md").read_bytes())},
    ] if baseline else []),
    "audit_confront": "05_DOCUMENTACAO/37_MARCO_2E_REVOGACAO_SESSOES_TOKEN_RESIDUAL.md#confronto-de-cada-achado-apos-o-segundo-parecer" if baseline else None,
    "residual_risks": (["F2E-01 Auth→commit", "F2E-03 dois navegadores físicos", "F2E-04 controle do host", "F2E-05 ponte Rₐ→Rₙ", "F2E-07 não reexecução do auditor", "JWT assinado com iat futuro não ensaiado", "F2E-09 bloqueio global pendente"] if baseline else []),
    "official_states": ({"0": "fechado tecnicamente", "1A/T05/T15": "concluído e auditado em laboratório", "1B": "funcional em laboratório", "1C": "Minha Obra funcional em laboratório", "2A": "planejamento concluído", "2B": "Ponto Experimental Online e Sintético funcional em laboratório", "2C": "planejamento de revogação/recuperação concluído", "2D": "Recuperação Local e Verificação de Integridade funcional em laboratório", "2E": "Revogação, Sessões e Token Residual funcional em laboratório sintético"} if baseline else {}),
    "proofs": (["JWT isolado não marca", "sessão, identidade, vínculo e contexto revalidados", "authorization_version comparada antes da conclusão e rollback se mudar", "token residual revogado sem novo evento", "refresh e novo login após revogação", "logout atual e global", "duas abas por mesma sessão e duas sessões sintéticas", "restart preserva corte", "restore antigo detectado", "João/Maria isolados", "admin Gestão sem titularidade no núcleo"] if baseline else []),
    "approval_effective_only_with_final_scan_receipt": baseline,
    "prohibited": (["produção", "funcionários reais", "piloto real", "ponto oficial", "REP-P", "Supabase remoto", "publicação", "GPS", "foto", "biometria", "offline oficial", "NSR oficial", "AFD", "AEJ", "ICP-Brasil", "cálculo de jornada", "banco de horas"] if baseline else []),
    "files": files,
    "inventory_count": len(files),
    "delta_from_2d": delta,
    "zip_entries": len(files) + 1,
    "secret_scan_receipt": "outputs/" + receipt_path.name,
}
payload["MANIFESTO_SHA256.json"] = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode()
assert manifest["secret_scan_receipt"] == receipt_path.relative_to(root).as_posix()
if dry_run:
    print(json.dumps({"dry_run": True, "zip": str(target), "receipt": manifest["secret_scan_receipt"], "entries": manifest["zip_entries"], "delta": len(delta), "baseline": baseline}))
    sys.exit(0)
with zipfile.ZipFile(target, "x", zipfile.ZIP_DEFLATED) as out:
    for relative_name, data in sorted(payload.items()):
        out.writestr(relative_name, data)
with zipfile.ZipFile(target) as archive:
    assert len(archive.namelist()) == manifest["zip_entries"]
    assert all(sha(archive.read(item["path"])) == item["sha256"] for item in files)
digest = sha(target.read_bytes())
scan_env = dict(os.environ, METALLO_EVIDENCE_REVISION="2e")
subprocess.run(["node", "04_BANCO_E_SUPABASE/laboratorio-marco-2d/verificar-segredos-2d.mjs", target.relative_to(root).as_posix()], cwd=root, env=scan_env, check=True, capture_output=True, text=True)
assert receipt_path.is_file(), "Recibo do scan direto não foi criado"
receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
assert receipt["passed"] and receipt["findings"] == []
assert receipt["zip"]["path"] == target.relative_to(root).as_posix()
assert receipt["zip"]["sha256"] == digest and receipt["zip"]["entries"] == manifest["zip_entries"]
assert (root / manifest["secret_scan_receipt"]).resolve() == receipt_path.resolve()
Path(str(target) + ".sha256").write_text(f"{digest}  {target.name}\n", encoding="utf-8", newline="\n")
print(json.dumps({"zip": str(target), "sha256": digest, "entries": manifest["zip_entries"], "delta": len(delta), "baseline": baseline, "receipt": str(receipt_path), "scan_passed": True, "findings": 0}))
