#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
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

fail() {
  echo "Error: $*" >&2
  exit 1
}

command -v node >/dev/null 2>&1 || fail "Node.js is required (version 18 or newer)."
command -v npm >/dev/null 2>&1 || fail "npm is required."
command -v docker >/dev/null 2>&1 || fail "Docker is required to start the local databases."
docker compose version >/dev/null 2>&1 || fail "Docker Compose is required."

# Stop stale SeniorSOS app processes first. Restrict termination to listener
# processes whose working directory is this project's backend or frontend.
stop_existing_project_listener() {
  local port="$1"
  local pids pid cwd pgid current_pgid
  local -a groups=()

  pids="$(lsof -nP -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -z "$pids" ]] && command -v fuser >/dev/null 2>&1; then
    pids="$(fuser -n tcp "$port" 2>/dev/null | awk '{ for (i = 2; i <= NF; i++) print $i }' || true)"
  fi
  [[ -n "$pids" ]] || return 0

  current_pgid="$(ps -o pgid= -p "$$" | tr -d ' ')"
  while IFS= read -r pid; do
    [[ "$pid" =~ ^[0-9]+$ ]] || continue
    cwd="$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)"
    if [[ "$cwd" != "$BACKEND_DIR" && "$cwd" != "$FRONTEND_DIR" ]]; then
      fail "Port $port is used by PID $pid outside this project's backend/frontend ($cwd); leaving it untouched."
    fi

    pgid="$(ps -o pgid= -p "$pid" | tr -d ' ')"
    [[ -n "$pgid" && "$pgid" != "$current_pgid" ]] || fail "Cannot safely stop PID $pid on port $port."
    groups+=("$pgid")
  done <<< "$pids"

  if ((${#groups[@]})); then
    echo "Stopping the existing SeniorSOS process on port $port..."
    for pgid in "${groups[@]}"; do
      kill -TERM -- "-$pgid" 2>/dev/null || true
    done
    for _ in {1..10}; do
      local still_running=0
      for pgid in "${groups[@]}"; do
        if kill -0 -- "-$pgid" 2>/dev/null; then still_running=1; fi
      done
      ((still_running == 0)) && break
      sleep 1
    done
    for pgid in "${groups[@]}"; do
      if kill -0 -- "-$pgid" 2>/dev/null; then
        kill -KILL -- "-$pgid" 2>/dev/null || true
      fi
    done
  fi
}

# Check the ports after cleanup. Vite otherwise silently moves to the next
# port, while Express crashes on an occupied port.
check_port_available() {
  local port="$1"
  if ! node -e '
    const net = require("node:net");
    const port = Number(process.argv[1]);
    const server = net.createServer();
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(`Port ${port} is already in use.`);
      } else {
        console.error(`Cannot check port ${port}: ${error.message}`);
      }
      process.exit(1);
    });
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () => {
      server.close();
    });
  ' "$port"; then
    fail "Free port $port, then rerun ./run.sh. If an earlier run is still open, press Ctrl+C in its terminal."
  fi
}

stop_existing_project_listener 5173
stop_existing_project_listener 5000
check_port_available 5173
check_port_available 5000

if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  [[ -f "$BACKEND_DIR/.env.example" ]] || fail "backend/.env.example is missing."
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  echo "Created backend/.env from backend/.env.example."
fi

# Install dependencies when absent or unusable on this machine (for example,
# after cloning dependencies that were installed on another operating system).
if ! (
  [[ -x "$BACKEND_DIR/node_modules/.bin/prisma" && -x "$FRONTEND_DIR/node_modules/.bin/vite" ]] &&
  (cd "$BACKEND_DIR" && npm ls --depth=0 >/dev/null 2>&1 && npx --no-install prisma --version >/dev/null 2>&1) &&
  (cd "$FRONTEND_DIR" && npm ls --depth=0 >/dev/null 2>&1 && node -e "require('esbuild').transformSync('const ready = true')" >/dev/null 2>&1)
); then
  echo "Installing backend and frontend dependencies..."
  (cd "$BACKEND_DIR" && npm ci)
  (cd "$FRONTEND_DIR" && npm ci)
fi

echo "Starting local PostgreSQL and MongoDB..."
docker compose -f "$ROOT_DIR/docker-compose.yml" up -d

wait_for_postgres() {
  for _ in {1..60}; do
    if docker compose -f "$ROOT_DIR/docker-compose.yml" exec -T postgres pg_isready -U seniorsos_user -d seniorsos >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

wait_for_mongodb() {
  for _ in {1..60}; do
    if docker compose -f "$ROOT_DIR/docker-compose.yml" exec -T mongodb mongosh --quiet --eval 'quit(db.adminCommand({ping: 1}).ok ? 0 : 1)' >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

echo "Waiting for databases to become ready..."
wait_for_postgres || fail "PostgreSQL did not become ready. Check: docker compose logs postgres"
wait_for_mongodb || fail "MongoDB did not become ready. Check: docker compose logs mongodb"

echo "Generating Prisma client and applying database migrations..."
npm --prefix "$BACKEND_DIR" run db:generate

# Prisma's migrate deploy can time out while waiting for its PostgreSQL
# advisory lock (P1002), especially on hosted/pooler databases. Retry only
# that transient lock timeout; schema and connection errors should fail fast.
migrate_with_lock_retry() {
  local attempt=1 max_attempts=4 status=0 output delay
  while ((attempt <= max_attempts)); do
    if output="$(npm --prefix "$BACKEND_DIR" run db:migrate:prod 2>&1)"; then
      printf '%s\n' "$output"
      return 0
    else
      status=$?
      printf '%s\n' "$output" >&2
    fi

    if [[ "$output" != *"P1002"* || $attempt -eq $max_attempts ]]; then
      return "$status"
    fi

    delay=$((attempt * 5))
    echo "Prisma migration lock timed out; retrying in ${delay}s (attempt $((attempt + 1))/$max_attempts)..." >&2
    sleep "$delay"
    ((attempt += 1))
  done
}

migrate_with_lock_retry

echo "Starting SeniorSOS frontend and backend..."
npm --prefix "$FRONTEND_DIR" run dev -- --host "${FRONTEND_HOST:-127.0.0.1}" --port 5173 --strictPort &
PIDS+=("$!")
npm --prefix "$BACKEND_DIR" run dev &
PIDS+=("$!")

echo "Frontend: http://localhost:5173"
echo "Backend:  http://localhost:5000"
echo "Databases: PostgreSQL :5433, MongoDB :27018"
echo "Press Ctrl+C to stop the frontend and backend."

wait -n "${PIDS[@]}"
