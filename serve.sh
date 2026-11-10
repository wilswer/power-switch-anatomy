#!/usr/bin/env bash
# Run the page server detached from the terminal, so it survives logout.
#   ./serve.sh start [port]   start (default port 8642)
#   ./serve.sh stop           stop it
#   ./serve.sh status         show whether it runs
# PID and log live in .run/ next to this script.
set -euo pipefail

cd "$(dirname "$0")"
RUN_DIR=.run
PIDFILE="$RUN_DIR/server.pid"
LOG="$RUN_DIR/server.log"
PORT="${2:-8642}"
mkdir -p "$RUN_DIR"

running() { [[ -s $PIDFILE ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; }

case "${1:-start}" in
  start)
    if running; then
      echo "Already running (PID $(cat "$PIDFILE")). Log: $LOG"
      exit 0
    fi
    rm -f "$PIDFILE"
    setsid nohup bash -c "echo \$\$ > '$PIDFILE'; exec python3 serve.py --port '$PORT'" \
      >"$LOG" 2>&1 </dev/null &
    for _ in $(seq 50); do
      [[ -s $PIDFILE ]] && grep -q Serving "$LOG" 2>/dev/null && break
      sleep 0.1
    done
    if running; then
      echo "Serving on http://127.0.0.1:$PORT/ (PID $(cat "$PIDFILE"), log $LOG)"
    else
      echo "Server failed to start; see $LOG" >&2
      cat "$LOG" >&2
      exit 1
    fi
    ;;
  stop)
    if running; then
      kill "$(cat "$PIDFILE")"
      echo "Stopped PID $(cat "$PIDFILE")"
    else
      echo "Not running"
    fi
    rm -f "$PIDFILE"
    ;;
  status)
    if running; then echo "Running (PID $(cat "$PIDFILE")). Log: $LOG"; else echo "Not running"; fi
    ;;
  *)
    echo "Usage: $0 {start|stop|status} [port]" >&2
    exit 2
    ;;
esac
