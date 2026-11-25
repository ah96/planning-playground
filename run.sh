#!/usr/bin/env bash
# Start the playground at http://127.0.0.1:5000/.
#
#   ./run.sh                          with python3 from the path
#   PYTHON=/path/to/python ./run.sh   with another interpreter
#   PORT=8000 ./run.sh                on another port
#
# It checks that the interpreter exists and can import Flask, then starts app.py.
set -euo pipefail
cd "$(dirname "$0")"
PY="${PYTHON:-python3}"
command -v "$PY" >/dev/null || { echo "No interpreter '$PY' found. Set PYTHON."; exit 1; }
"$PY" -c 'import flask' 2>/dev/null || { echo "Flask is missing.  $PY -m pip install -r requirements.txt"; exit 1; }
echo "AI Planning Playground -> http://127.0.0.1:${PORT:-5000}/"
exec "$PY" app.py
