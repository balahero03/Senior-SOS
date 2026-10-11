#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PIDS=()

stop_services() {
  trap - INT TERM EXIT
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  for pid in "${PIDS[@]}"; do
    wait "$pid" 2>/dev/null || true
  done
}

trap stop_services INT TERM EXIT

if [[ ! -f "$ROOT_DIR/backend/.env" ]]; then
  echo "Missing backend/.env. Create it from backend/.env.example and configure database URLs first." >&2
  exit 1
fi

echo "Starting SeniorSOS frontend and backend..."
npm --prefix "$ROOT_DIR/frontend" run dev -- --host "${FRONTEND_HOST:-127.0.0.1}" &
PIDS+=("$!")

npm --prefix "$ROOT_DIR/backend" run dev &
PIDS+=("$!")

echo "Frontend: http://localhost:5173"
echo "Backend:  http://localhost:5000"
echo "Press Ctrl+C to stop both services."

wait -n "${PIDS[@]}"
