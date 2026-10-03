"""Gera pacotes passivos de auditoria e a baseline aprovada 2F a partir da 2E."""

from pathlib import Path, PurePosixPath
import datetime
import hashlib
import json
import os
import re
import subprocess
import sys
import zipfile

root = Path(__file__).resolve().parents[2]
assert len(sys.argv) == 2 and sys.argv[1] in {"1", "2", "baseline"}, "Uso: gerar-pacote-auditoria-2f.py 1|2|baseline"
cycle = sys.argv[1]
baseline = cycle == "baseline"
origin = root / "outputs/Metallo-Marco2E-BaselineAprovada-20260927-R1.zip"
origin_hash = "c0c54b8e29cb0d29f2ebf29bf485d79b52632008a09d6e7261c90fae4c66b0ad"
target = root / ("outputs/Metallo-Marco2F-BaselineAprovada-20260928-R1.zip" if baseline
                 else f"outputs/Metallo-Marco2F-Reconciliacao-Auditoria-20260928-Ciclo{cycle}.zip")
receipt_path = Path(str(target) + ".verificacao.json")
sha_path = Path(str(target) + ".sha256")

def sha(data):
    return hashlib.sha256(data).hexdigest()

assert not any(p.exists() for p in (target, receipt_path, sha_path)), "Pacote 2F já existe"
assert sha(origin.read_bytes()) == origin_hash, "Baseline 2E mudou"
assert not (root / "04_BANCO_E_SUPABASE/laboratorio-marco-1a/supabase/.temp/project-ref").exists()
with zipfile.ZipFile(origin) as source:
    old_manifest = json.loads(source.read("MANIFESTO_SHA256.json"))
old_files = {item["path"]: item["sha256"] for item in old_manifest["files"]}

# Reutiliza o inventário aprovado 2E. Entradas virtuais e recibos antigos
# ficam representados pelo manifesto de origem, sem duplicar ZIPs no novo pacote.
paths = {name for name in old_files if (root / name).is_file()
         and not name.startswith("outputs/")}
paths.add("05_DOCUMENTACAO/38_MARCO_2F_RECONCILIACAO_E_FECHAMENTO_SINTETICO.md")
evidence = root / "04_BANCO_E_SUPABASE/laboratorio-marco-2f"
for path in evidence.iterdir():
    if (path.is_file() and path.suffix in {".mjs", ".py", ".sql", ".json", ".log"}
            and path.name not in {"servidor.log", "servidor-erro.log"}
            and not (baseline and path.name == "resultado-segredos-2f.json")):
        paths.add(path.relative_to(root).as_posix())
if cycle in {"2", "baseline"}:
    paths.add("04_BANCO_E_SUPABASE/laboratorio-marco-2f/parecer-grok-ciclo1.md")
    paths.add("outputs/Metallo-Marco2F-Reconciliacao-Auditoria-20260928-Ciclo1.zip.verificacao.json")
if baseline:
    paths.add("04_BANCO_E_SUPABASE/laboratorio-marco-2f/parecer-grok-ciclo2.md")
    paths.add("outputs/Metallo-Marco2F-Reconciliacao-Auditoria-20260928-Ciclo2.zip.verificacao.json")
    paths.add("outputs/Metallo-Marco2F-Grok-Ciclo2-veredito.png")
    audit2 = root / "outputs/Metallo-Marco2F-Reconciliacao-Auditoria-20260928-Ciclo2.zip"
    assert sha(audit2.read_bytes()) == "3d9178e8e549d79d37ab66d5186b438665cb18da7575e96cb7cc7c4279bae9d0"
    assert sha((evidence / "parecer-grok-ciclo1.md").read_bytes()) == "0c86fda4abfc9d5587d232cbc2adb6c362a28a2afd2f917fcbf0f811f13dcd7e"
    assert sha((evidence / "parecer-grok-ciclo2.md").read_bytes()) == "da9b2013ee5dc73de43e53080015662664dfbf28a67c90d28f916793c3ff469d"
    with zipfile.ZipFile(audit2) as archived:
        audit2_manifest = json.loads(archived.read("MANIFESTO_SHA256.json"))
    audit2_files = {item["path"]: item["sha256"] for item in audit2_manifest["files"]}

payload = {}
for name in sorted(paths):
    parts = PurePosixPath(name).parts
    assert parts and not any(part in {"..", ".git", ".temp", "backups", "node_modules"}
                             or part.startswith(".env") for part in parts), name
    assert not name.lower().endswith((".pem", ".key", ".pfx", ".p12", ".sqlite", ".db")), name
    payload[name] = (root / name).read_bytes()
    if baseline and name in audit2_files and name not in {
        "05_DOCUMENTACAO/38_MARCO_2F_RECONCILIACAO_E_FECHAMENTO_SINTETICO.md",
        "04_BANCO_E_SUPABASE/laboratorio-marco-2f/gerar-pacote-auditoria-2f.py",
        "04_BANCO_E_SUPABASE/laboratorio-marco-2d/verificar-segredos-2d.mjs",
    }:
        assert sha(payload[name]) == audit2_files[name], f"Mudança após auditoria: {name}"

report = json.loads((evidence / "resultado-2f.json").read_text(encoding="utf-8-sig"))
expected = 27 if cycle == "1" else 28
assert len(report["checks"]) == expected and all(item["ok"] for item in report["checks"])
history = json.loads((evidence / "base-real.json").read_text(encoding="utf-8-sig"))
assert len(history["checks"]) == 683 and all(item["ok"] for item in history["checks"])
assert "117 passed" in (evidence / "web.log").read_text(encoding="utf-8-sig")
for name, total in (("banco.log", 31), ("qualidade.log", 44)):
    log = (evidence / name).read_text(encoding="utf-8-sig")
    assert re.search(rf"\bpass {total}\b", log) and re.search(r"\bfail 0\b", log), name
local_scan = json.loads((evidence / "resultado-segredos-2f.json").read_text())
assert local_scan["passed"] and local_scan["findings"] == []

payload["BASELINE_2E_MANIFESTO.json"] = (json.dumps(old_manifest, ensure_ascii=False, indent=2) + "\n").encode()
if cycle in {"2", "baseline"}:
    payload["BASELINE_2E_ORIGINAL.zip"] = origin.read_bytes()
payload["LEIA-ME.md"] = f"""# Marco 2F — {'baseline aprovada METALLO-2F-LAB-20260928-R1' if baseline else f'pacote de auditoria, ciclo {cycle}'}

**SIMULAÇÃO SEM VALOR OFICIAL.** {'Fechamento formal autorizado em 28/09/2026.' if baseline else 'Revisão somente leitura; não é baseline.'}
Não é publicação, produção, piloto real, ponto oficial nem REP-P.

Origem imutável: METALLO-2E-LAB-20260927-R1, SHA-256 {origin_hash}.
Leia `05_DOCUMENTACAO/38_MARCO_2F_RECONCILIACAO_E_FECHAMENTO_SINTETICO.md`,
`MANIFESTO_SHA256.json`, o delta, o código e as provas. As suítes se sobrepõem.
A baseline original 2E {'está incluída em BASELINE_2E_ORIGINAL.zip' if cycle in {'2', 'baseline'} else 'não está incluída; apenas seu manifesto'}.
A aprovação visual foi registrada em 28/09/2026; o parecer é independente
e passivo. O recibo externo do scan direto é `outputs/{receipt_path.name}`;
ele será gerado após este ZIP e não pode estar dentro dele sem autorreferência.
{'Os dois pareceres Grok e os respectivos recibos estão no inventário. O manifesto registra o confronto, os resultados, os riscos e os limites.' if baseline else ''}
""".encode()

files = [{"path": name, "bytes": len(data), "sha256": sha(data)}
         for name, data in sorted(payload.items())]
delta = [{"path": name, "kind": "novo" if name not in old_files else "alterado",
          "old_sha256": old_files.get(name), "current_sha256": sha(data)}
         for name, data in sorted(payload.items())
         if name not in old_files or old_files[name] != sha(data)]
manifest = {
    "id": "METALLO-2F-LAB-20260928-R1" if baseline else f"METALLO-2F-AUDITORIA-CICLO{cycle}",
    "is_approved_baseline": baseline,
    "at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "origin": {"id": "METALLO-2E-LAB-20260927-R1", "sha256": origin_hash},
    "visual_approval": "Responsável aprovou a prévia 2F e o texto revisado do login em 28/09/2026",
    "mandatory_label": "SIMULAÇÃO SEM VALOR OFICIAL",
    "results": {"2F": f"{expected}/{expected}", "2E": "34/34", "2D": "49/49", "2B": "64/64",
                "Auth_real": "17/17", "transporte": "13/13", "revogacao_concorrente": "5/5",
                "base_historica": "683/683", "minha_obra": "45/45", "Web": "117/117",
                "banco": "31/31", "qualidade": "44/44", "rede": "8/8",
                "TypeScript_lint_build": "aprovados"},
    "overlapping_suites_do_not_sum": True,
    "cycle_1_zip_sha256": "3a2df3452c9e1d9dcf3d71da0e36e3b01bc8c232c0e6a80aa898beff8aa58169" if cycle in {"2", "baseline"} else None,
    "cycle_1_opinion_sha256": sha((evidence / "parecer-grok-ciclo1.md").read_bytes()) if cycle in {"2", "baseline"} else None,
    "scope": "local e sintético; remoto intocado; sem publicação",
    "audit_mode": "inspeção passiva; proibido executar projeto, SQL, Auth, testes e rede do laboratório",
    "files": files,
    "inventory_count": len(files),
    "delta_from_2e": delta,
    "zip_entries": len(files) + 1,
    "secret_scan_receipt": receipt_path.relative_to(root).as_posix(),
}
if baseline:
    manifest.update({
        "formal_approval": "Responsável autorizou fechamento e baseline 2F em 28/09/2026, após aprovar prévia visual e dois ciclos Grok",
        "phase_status": "fase de endurecimento do ponto experimental sintético encerrada; sem Marco 2G",
        "global_logout_fix": "concluir somente após origem comprovar oldSessions == 0; caso 28 passou",
        "cycle_2_zip_sha256": "3d9178e8e549d79d37ab66d5186b438665cb18da7575e96cb7cc7c4279bae9d0",
        "cycle_2_opinion_sha256": sha((evidence / "parecer-grok-ciclo2.md").read_bytes()),
        "grok_conversation": "https://grok.com/c/1b0b269a-22d5-4dec-a1b8-4501d1124e3e",
        "grok_confrontation": "12 itens do ciclo 1 confrontados; F2F-C1-05 corrigido e testado; F2F-C2-01 corrigido na documentação; nenhum crítico/alto confirmado e aberto no escopo local",
        "official_milestones": {
            "0": "fechado tecnicamente", "1A/T05/T15": "concluído e auditado em laboratório",
            "1B": "funcional em laboratório", "1C": "Minha Obra funcional em laboratório",
            "2A": "planejamento concluído", "2B": "Ponto Experimental Online e Sintético funcional em laboratório",
            "2C": "planejamento de revogação/recuperação concluído",
            "2D": "Recuperação Local e Verificação de Integridade funcional em laboratório",
            "2E": "Revogação, Sessões e Token Residual funcional em laboratório sintético",
            "2F": "Reconciliação de Revogação e fechamento consolidado funcional em laboratório sintético",
        },
        "residual_risks": [
            "leitura de resultado já confirmado com token residual até expirar",
            "janela entre última verificação e gravação",
            "administrador do host controla banco e âncora",
            "segundo computador físico não testado",
        ],
        "risks_relevant_before_real_pilot_or_production": True,
        "limits": "sem funcionários reais, piloto, produção, ponto oficial, REP-P, Supabase remoto, publicação, GPS, foto, biometria, offline oficial, NSR, AFD, AEJ, ICP-Brasil, cálculo de jornada ou banco de horas",
        "next_phase_only_recommended": "Marco 3A — Meu Perfil + Minha Equipe; não implementado",
        "results_are_existing_evidence_not_rerun_at_closure": True,
    })
payload["MANIFESTO_SHA256.json"] = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode()

with zipfile.ZipFile(target, "x", zipfile.ZIP_DEFLATED) as archive:
    for name, data in sorted(payload.items()):
        archive.writestr(name, data)
with zipfile.ZipFile(target) as archive:
    assert len(archive.namelist()) == manifest["zip_entries"]
    assert all(sha(archive.read(item["path"])) == item["sha256"] for item in files)

digest = sha(target.read_bytes())
env = dict(os.environ, METALLO_EVIDENCE_REVISION="2f")
subprocess.run(["node", "04_BANCO_E_SUPABASE/laboratorio-marco-2d/verificar-segredos-2d.mjs",
                target.relative_to(root).as_posix()], cwd=root, env=env, check=True,
               capture_output=True, text=True)
assert receipt_path.is_file(), "Recibo do scan direto ausente"
receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
assert receipt["passed"] and receipt["findings"] == []
assert receipt["zip"] == {"path": target.relative_to(root).as_posix(),
                          "sha256": digest, "entries": manifest["zip_entries"]}
sha_path.write_text(f"{digest}  {target.name}\n", encoding="utf-8", newline="\n")
print(json.dumps({"zip": str(target), "sha256": digest,
                  "entries": manifest["zip_entries"], "delta": len(delta),
                  "receipt": str(receipt_path), "scan_files": receipt["files_scanned_including_nested"],
                  "findings": len(receipt["findings"])}))
