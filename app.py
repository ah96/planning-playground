"""Flask entry point for the AI Planning Playground.

The server owns the planners and hands the browser a *recording* of each search:
the order in which cells (or block states) were expanded, plus the plan that
came out.  The client then replays that recording at whatever speed the
presenter wants.  Keeping the search in Python means the planners can be read
and tested on their own, and keeping the animation in the browser means the
replay stays smooth no matter how slow the search was.

Run it with::

    python app.py            # then open http://127.0.0.1:5000/

If you would rather not run a server at all, ``tools/build_standalone.py``
bakes the whole thing into a single HTML file.
"""

from __future__ import annotations

import os

from flask import Flask, jsonify, render_template, request

from planning import GridProblem, search
from planning.blocksworld import BlocksProblem, State, describe_action, predicates
from planning.presets import BLOCK_PROBLEMS, GRID_MAPS, block_problem, grid_map
from planning.search import STRATEGIES

app = Flask(__name__)
app.config["JSON_SORT_KEYS"] = False


# --------------------------------------------------------------------- pages
@app.route("/")
def index():
    return render_template("index.html")


# ------------------------------------------------------------------- presets
@app.route("/api/presets", methods=["GET"])
def api_presets():
    """Both catalogues at once: the client caches them for the whole session."""
    return jsonify({
        "grids": [
            {
                "id": m["id"], "name": m["name"], "lesson": m["lesson"],
                "rows": m["rows"], "start": m["start"], "goal": m["goal"],
                "diagonal": m["diagonal"],
            }
            for m in GRID_MAPS
        ],
        "blocks": [
            {
                "id": b["id"], "name": b["name"], "lesson": b["lesson"],
                "start": b["start"], "goal": b["goal"],
            }
            for b in BLOCK_PROBLEMS
        ],
        "strategies": list(STRATEGIES),
    })


# ---------------------------------------------------------------------- grid
def _grid_from_request(data: dict) -> GridProblem:
    rows = data.get("rows")
    if not rows:
        raise ValueError("no map given")
    start = tuple(data.get("start", (0, 0)))
    goal = tuple(data.get("goal", (0, 0)))
    return GridProblem(list(rows), start, goal, bool(data.get("diagonal", False)))


def _grid_result(result) -> dict:
    return {
        **result.stats,
        "expanded": [[r, c] for (r, c) in result.expanded],
        "g": result.g_of_expanded,
        "path": [[r, c] for (r, c) in result.states],
    }


@app.route("/api/grid/plan", methods=["POST"])
def api_grid_plan():
    data = request.get_json(silent=True) or {}
    try:
        problem = _grid_from_request(data)
    except (ValueError, IndexError) as exc:
        return jsonify({"error": str(exc)}), 400

    wanted = data.get("algorithms") or [data.get("algorithm", "astar")]
    bad = [a for a in wanted if a not in STRATEGIES]
    if bad:
        return jsonify({"error": f"unknown algorithm(s): {', '.join(bad)}"}), 400

    return jsonify({"results": [_grid_result(search(problem, a)) for a in wanted]})


@app.route("/api/grid/score", methods=["POST"])
def api_grid_score():
    """Score a path a human drew against the optimum for the same map."""
    data = request.get_json(silent=True) or {}
    try:
        problem = _grid_from_request(data)
        cells = [tuple(c) for c in data.get("path", [])]
    except (ValueError, IndexError) as exc:
        return jsonify({"error": str(exc)}), 400

    best = search(problem, "astar")
    if not cells:
        return jsonify({"valid": False, "reason": "empty", "optimal": round(best.cost, 3)})
    if cells[0] != problem.start or cells[-1] != problem.goal:
        return jsonify({"valid": False, "reason": "endpoints", "optimal": round(best.cost, 3)})
    if any(problem.is_wall(c) for c in cells):
        return jsonify({"valid": False, "reason": "wall", "optimal": round(best.cost, 3)})
    try:
        cost = problem.path_cost(cells)
    except ValueError:
        return jsonify({"valid": False, "reason": "jump", "optimal": round(best.cost, 3)})

    optimal = best.cost if best.found else 0.0
    return jsonify({
        "valid": True,
        "cost": round(cost, 3),
        "optimal": round(optimal, 3),
        "steps": len(cells) - 1,
        "optimalSteps": max(len(best.states) - 1, 0),
        "ratio": round(cost / optimal, 3) if optimal else None,
    })


# -------------------------------------------------------------------- blocks
@app.route("/api/blocks/plan", methods=["POST"])
def api_blocks_plan():
    """Plan, then annotate every step with the preconditions it relied on."""
    data = request.get_json(silent=True) or {}
    try:
        if data.get("preset"):
            problem = block_problem(data["preset"])
        else:
            start = State.of(data.get("stacks", []), data.get("holding"))
            problem = BlocksProblem(start, tuple(data.get("goal", [])))
    except (KeyError, ValueError) as exc:
        return jsonify({"error": str(exc)}), 400

    strategy = data.get("algorithm", "astar")
    if strategy not in STRATEGIES:
        return jsonify({"error": f"unknown algorithm {strategy!r}"}), 400

    result = search(problem, strategy)
    steps = []
    for i, action in enumerate(result.plan):
        before = result.states[i]
        steps.append({
            **describe_action(action, before),
            "before": _state_json(before),
            "after": _state_json(result.states[i + 1]),
        })

    return jsonify({
        **result.stats,
        "goal": list(problem.goal_facts),
        "initial": _state_json(problem.start),
        "steps": steps,
        # how many states each strategy had to look at, for the comparison bar
        "compare": {s: search(problem, s).stats for s in STRATEGIES},
    })


def _state_json(state: State) -> dict:
    return {
        "stacks": [list(s) for s in state.stacks],
        "holding": state.holding,
        "predicates": predicates(state),
    }


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(debug=bool(os.environ.get("DEBUG")), host="127.0.0.1", port=port)
