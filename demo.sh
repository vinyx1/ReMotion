#!/usr/bin/env bash
# ReMotion demo: starts the dashboard, then the one-key demo menu. Run: ./demo.sh
set -e
cd "$(dirname "$0")"

# First run only: Python environment and dashboard packages
if [ ! -x .venv/bin/python ]; then
  python3 -m venv .venv
  .venv/bin/pip install -q -r requirements.txt
fi
[ -d software/web/node_modules ] || (cd software/web && npm install)

# Dashboard in the background (its own process group), stopped when this script ends
setsid bash -c 'cd software/web && exec npm run dev -- --port 5173 --strictPort' >/dev/null 2>&1 &
DASH=$!
trap 'kill -- -$DASH 2>/dev/null || true' EXIT
for _ in $(seq 30); do curl -s -o /dev/null localhost:5173 && break; sleep 0.5; done
echo "Dashboard: http://localhost:5173/dashboard"
xdg-open http://localhost:5173/dashboard >/dev/null 2>&1 || true

.venv/bin/python -m software.tools.demo "$@"
