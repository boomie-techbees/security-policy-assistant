#!/usr/bin/env bash
# Run from anywhere inside the project; goes to project root then starts the frontend.
# Frees port 5173 if in use so the app always runs at http://localhost:5173
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/frontend"
for pid in $(lsof -t -i :5173 2>/dev/null); do kill "$pid" 2>/dev/null; done
sleep 1
for pid in $(lsof -t -i :5173 2>/dev/null); do kill -9 "$pid" 2>/dev/null; done
sleep 1
exec npm run dev
