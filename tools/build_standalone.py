"""Bake the whole playground into one HTML file that needs no server.

The single-file build reuses the *same* stylesheet, views and controllers as
the Flask app.  Only two things are swapped:

* ``api.js`` (HTTP) becomes ``api_local.js`` (the JavaScript planner), and
* the preset catalogue is exported from Python and inlined, so the maps and
  block problems have exactly one source of truth -- ``planning/presets.py``.

Run it with::

    python tools/build_standalone.py

and open ``standalone/planning_playground.html`` by double-clicking it.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from planning.presets import BLOCK_PROBLEMS, GRID_MAPS  # noqa: E402
from planning.search import STRATEGIES  # noqa: E402

OUT = ROOT / "standalone" / "planning_playground.html"

# The scripts, in load order.  api_local.js stands in for api.js.
SCRIPTS = [
    "static/js/i18n.js",
    "static/js/planner/core.js",
    "static/js/api_local.js",
    "static/js/grid_view.js",
    "static/js/grid_controller.js",
    "static/js/blocks_view.js",
    "static/js/blocks_controller.js",
    "static/js/main.js",
]


def presets_payload() -> dict:
    """Exactly what /api/presets returns, so api_local can serve it verbatim."""
    return {
        "grids": [
            {"id": m["id"], "name": m["name"], "lesson": m["lesson"], "rows": m["rows"],
             "start": m["start"], "goal": m["goal"], "diagonal": m["diagonal"]}
            for m in GRID_MAPS
        ],
        "blocks": [
            {"id": b["id"], "name": b["name"], "lesson": b["lesson"],
             "start": b["start"], "goal": b["goal"]}
            for b in BLOCK_PROBLEMS
        ],
        "strategies": list(STRATEGIES),
    }


def body_of_template() -> str:
    """The markup between <body> and </body>, minus the Flask script tags."""
    html = (ROOT / "templates" / "index.html").read_text(encoding="utf-8")
    body = re.search(r"<body>(.*)</body>", html, re.S).group(1)
    body = re.sub(r"<script[^>]*></script>\s*", "", body)
    body = re.sub(r'<script>window\.PP_MODE[^<]*</script>\s*', "", body)
    return body.strip()


def build() -> Path:
    css = (ROOT / "static" / "css" / "style.css").read_text(encoding="utf-8")
    langs = {
        code: json.loads((ROOT / "static" / "lang" / f"{code}.json").read_text(encoding="utf-8"))
        for code in ("en", "de")
    }
    scripts = "\n".join(
        f"/* ---- {name} ---- */\n" + (ROOT / name).read_text(encoding="utf-8")
        for name in SCRIPTS
    )

    # </script> inside a string literal would close the tag early.
    def safe(obj) -> str:
        return json.dumps(obj, ensure_ascii=False).replace("</", "<\\/")

    doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI Planning Playground</title>
<!-- Built by tools/build_standalone.py — do not edit by hand.
     Everything runs in this one file; no server, no network. -->
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
{css}
</style>
</head>
<body>
{body_of_template()}
<script>
window.PP_MODE = "standalone";
window.PP_LANGS = {safe(langs)};
window.PP_PRESETS = {safe(presets_payload())};
</script>
<script>
{scripts}
</script>
</body>
</html>
"""
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(doc, encoding="utf-8")
    return OUT


if __name__ == "__main__":
    path = build()
    print(f"wrote {path.relative_to(ROOT)}  ({path.stat().st_size / 1024:.0f} KB)")
