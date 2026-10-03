#!/bin/sh
# Supervisor do coletor auxiliar: nenhuma alteração em arquivos gerados pela CLI.
# Dependência indisponível é espera local, não falha do portal.
set -u
child=''
waiter=''
last_state=''
attempt=0
delay=5
state() {
  printf '%s\n' "$1" > /tmp/coletor-estado
  if [ "$last_state" != "$1" ]; then
    printf '%s %s\n' "$(date -u +%FT%TZ)" "$2"
    last_state="$1"
  fi
}
shutdown() {
  trap '' TERM INT
  state ENCERRANDO 'Coletor: encerramento solicitado; liberando o processo filho.'
  if [ -n "$waiter" ]; then kill -TERM "$waiter" 2>/dev/null || true; wait "$waiter" 2>/dev/null || true; fi
  if [ -n "$child" ]; then kill -TERM "$child" 2>/dev/null || true; wait "$child" 2>/dev/null || true; fi
  exit 0
}
trap shutdown TERM INT
pause() { sleep "$1" & waiter=$!; wait "$waiter" || true; waiter=''; }
while :; do
  if [ ! -S /var/run/docker.sock ]; then
    state AGUARDANDO_DOCKER 'Coletor aguardando socket Docker local. Portal não é declarado indisponível por esse motivo.'
  elif ! wget -q -T 3 --spider http://supabase_analytics_laboratorio-marco-1a:4000/health 2>/dev/null; then
    state AGUARDANDO_LABORATORIO 'Coletor aguardando Analytics local. Laboratório parado ou dependência indisponível; nova tentativa com backoff.'
  else
    state CONECTANDO 'Coletor conectando somente ao Docker e Analytics locais.'
    vector --config /etc/metallo/vector.yaml --graceful-shutdown-limit-secs 5 & child=$!
    dependency_lost=0
    while kill -0 "$child" 2>/dev/null; do
      pause 5
      if ! wget -q -T 3 --spider http://supabase_analytics_laboratorio-marco-1a:4000/health 2>/dev/null; then
        state AGUARDANDO_LABORATORIO 'Coletor aguardando Analytics local; encerrando coleta até a dependência retornar.'
        dependency_lost=1
        kill -TERM "$child" 2>/dev/null || true
        break
      elif wget -q -T 2 --spider http://127.0.0.1:9001/health 2>/dev/null; then
        if [ "$last_state" != 'ATIVO' ]; then rm -f /tmp/coletor-tentativa; fi
        state ATIVO 'Coletor ativo. Logs restritos aos serviços deste laboratório.'
        attempt=0
        delay=5
      fi
    done
    wait "$child"; result=$?; child=''
    if [ "$dependency_lost" -eq 0 ]; then state RECONECTANDO "Coletor encerrou (código $result); reconexão controlada, sem restart automático do container."; fi
  fi
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 5 ]; then
    printf '%s %s %s\n' "$(date -u +%s)" "$attempt" '300' > /tmp/coletor-tentativa
    state ESPERA 'Coletor em espera após cinco tentativas. Próxima conferência em 300s; sem spam ou loop rápido de restart.'
    pause 300
    attempt=0
    delay=5
  else
    printf '%s %s %s\n' "$(date -u +%s)" "$attempt" "$delay" > /tmp/coletor-tentativa
    pause "$delay"
    delay=$((delay * 2))
  fi
done
