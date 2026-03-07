#!/usr/bin/env bash
# Run from anywhere inside the project; goes to project root then starts the backend.
# Frees port 8000 if already in use (e.g. leftover from a previous run).
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"
# Free port 8000 (normal kill, then force if still in use)
for pid in $(lsof -t -i :8000 2>/dev/null); do kill "$pid" 2>/dev/null; done
sleep 1
for pid in $(lsof -t -i :8000 2>/dev/null); do kill -9 "$pid" 2>/dev/null; done
sleep 1
source .venv/bin/activate
exec uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
