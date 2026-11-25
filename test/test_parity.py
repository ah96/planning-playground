"""The Python planner and the JavaScript port must agree, exactly.

The app ships twice: Flask serves plans from ``planning/`` and the standalone
HTML computes them in ``static/js/planner/core.js``.  Two implementations mean
two chances to be wrong, so this test runs both over every preset and compares
not just the answers but the *whole search trace* -- the order in which states
were expanded.  If a tie-break drifts apart, the animations would differ and
this fails.

It needs Google Chrome on PATH; without it the test skips rather than pretends.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from planning import GridProblem, search  # noqa: E402
from planning.presets import BLOCK_PROBLEMS, GRID_MAPS, block_problem  # noqa: E402
from planning.search import STRATEGIES  # noqa: E402
from tools.build_standalone import presets_payload  # noqa: E402

CHROME = next((c for c in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser")
               if shutil.which(c)), None)

HARNESS = """<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<pre id="out"></pre>
<script>window.PP_PRESETS = __PRESETS__;</script>
<script>__CORE__</script>
<script>
const P = window.Planner, out = { grids: {}, blocks: {} };
for (const m of window.PP_PRESETS.grids) {
  const problem = P.GridProblem(m.rows, m.start, m.goal, m.diagonal);
  out.grids[m.id] = {};
  for (const s of P.STRATEGIES) {
    const r = P.search(problem, s);
    out.grids[m.id][s] = {
      found: r.found,
      cost: Math.round(r.cost * 1000) / 1000,
      planLength: r.plan.length,
      generated: r.generated,
      maxFrontier: r.maxFrontier,
      expanded: r.expanded.map((k) => problem.cellOf(k)),
      path: r.states.map((c) => [c[0], c[1]]),
    };
  }
}
for (const b of window.PP_PRESETS.blocks) {
  const problem = P.BlocksProblem(P.stateOf(b.start.stacks, b.start.holding), b.goal);
  out.blocks[b.id] = {};
  for (const s of P.STRATEGIES) {
    const r = P.search(problem, s);
    out.blocks[b.id][s] = {
      found: r.found,
      expanded: r.expanded.length,
      generated: r.generated,
      planLength: r.plan.length,
      plan: r.plan.map((a) => a.name + "(" + a.args.join(", ") + ")"),
    };
  }
}
document.getElementById("out").textContent = JSON.stringify(out);
</script></body></html>
"""


@pytest.fixture(scope="module")
def js_results():
    if not CHROME:
        pytest.skip("no Chrome/Chromium on PATH")
    core = (ROOT / "static" / "js" / "planner" / "core.js").read_text(encoding="utf-8")
    page = (HARNESS
            .replace("__PRESETS__", json.dumps(presets_payload()))
            .replace("__CORE__", core))
    with tempfile.TemporaryDirectory() as tmp:
        html = Path(tmp) / "harness.html"
        html.write_text(page, encoding="utf-8")
        proc = subprocess.run(
            [CHROME, "--headless=new", "--disable-gpu", "--no-sandbox",
             f"--user-data-dir={tmp}/profile", "--virtual-time-budget=60000",
             "--dump-dom", html.as_uri()],
            capture_output=True, text=True, timeout=300,
        )
        dom = proc.stdout
    match = re.search(r'<pre id="out">(.*?)</pre>', dom, re.S)
    assert match, f"harness produced no output; chrome said: {proc.stderr[:400]}"
    raw = (match.group(1).replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
           .replace("&quot;", '"'))
    return json.loads(raw)


def py_grid(map_id, strategy):
    m = next(m for m in GRID_MAPS if m["id"] == map_id)
    problem = GridProblem(m["rows"], tuple(m["start"]), tuple(m["goal"]), m["diagonal"])
    r = search(problem, strategy)
    return {
        "found": r.found,
        "cost": round(r.cost, 3),
        "planLength": len(r.plan),
        "generated": r.generated,
        "maxFrontier": r.max_frontier,
        "expanded": [[a, b] for (a, b) in r.expanded],
        "path": [[a, b] for (a, b) in r.states],
    }


@pytest.mark.parametrize("map_id", [m["id"] for m in GRID_MAPS])
@pytest.mark.parametrize("strategy", STRATEGIES)
def test_grid_traces_are_identical(js_results, map_id, strategy):
    js = js_results["grids"][map_id][strategy]
    py = py_grid(map_id, strategy)
    assert js["found"] == py["found"]
    assert js["cost"] == pytest.approx(py["cost"]), "cost differs"
    assert js["planLength"] == py["planLength"], "plan length differs"
    assert js["generated"] == py["generated"], "generated count differs"
    assert js["maxFrontier"] == py["maxFrontier"], "peak frontier differs"
    assert len(js["expanded"]) == len(py["expanded"]), "expansion count differs"
    assert js["expanded"] == py["expanded"], "expansion ORDER differs — the animations would diverge"
    assert js["path"] == py["path"], "path differs"


@pytest.mark.parametrize("problem_id", [b["id"] for b in BLOCK_PROBLEMS])
@pytest.mark.parametrize("strategy", STRATEGIES)
def test_block_plans_are_identical(js_results, problem_id, strategy):
    js = js_results["blocks"][problem_id][strategy]
    r = search(block_problem(problem_id), strategy)
    assert js["found"] == r.found
    assert js["expanded"] == len(r.expanded), "expansion count differs"
    assert js["generated"] == r.generated, "generated count differs"
    assert js["plan"] == [str(a) for a in r.plan], "the two ports chose different plans"
