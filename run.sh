#!/usr/bin/env bash
# Start the playground. Uses Amar's venv if it is there, otherwise plain python3.
set -euo pipefail
cd "$(dirname "$0")"
PY="${PYTHON:-$HOME/venvamar/bin/python}"
[ -x "$PY" ] || PY="python3"
"$PY" -c 'import flask' 2>/dev/null || { echo "Flask is missing.  $PY -m pip install -r requirements.txt"; exit 1; }
echo "AI Planning Playground -> http://127.0.0.1:${PORT:-5000}/"
exec "$PY" app.py
