"""The Python planner: the guarantees each strategy is supposed to give."""

import math
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from planning import GridProblem, search
from planning.blocksworld import BlocksProblem, State, describe_action, predicates
from planning.presets import BLOCK_PROBLEMS, GRID_MAPS, block_problem, grid_map
from planning.search import STRATEGIES


def grid(map_id):
    m = grid_map(map_id)
    return GridProblem(m["rows"], tuple(m["start"]), tuple(m["goal"]), m["diagonal"])


# ------------------------------------------------------------------- basics
@pytest.mark.parametrize("map_id", [m["id"] for m in GRID_MAPS])
@pytest.mark.parametrize("strategy", STRATEGIES)
def test_every_preset_is_solvable(map_id, strategy):
    result = search(grid(map_id), strategy)
    assert result.found, f"{strategy} found no path on {map_id}"
    assert result.states[0] == grid(map_id).start
    assert result.states[-1] == grid(map_id).goal


@pytest.mark.parametrize("map_id", [m["id"] for m in GRID_MAPS])
def test_reported_cost_matches_the_path(map_id):
    problem = grid(map_id)
    for strategy in STRATEGIES:
        result = search(problem, strategy)
        assert result.cost == pytest.approx(problem.path_cost(result.states)), strategy


@pytest.mark.parametrize("map_id", [m["id"] for m in GRID_MAPS])
def test_dijkstra_and_astar_agree_on_the_optimum(map_id):
    """Both are optimal, so they must agree on cost even if the paths differ."""
    problem = grid(map_id)
    assert search(problem, "dijkstra").cost == pytest.approx(search(problem, "astar").cost)


@pytest.mark.parametrize("map_id", [m["id"] for m in GRID_MAPS])
def test_nobody_beats_the_optimum(map_id):
    problem = grid(map_id)
    best = search(problem, "astar").cost
    for strategy in STRATEGIES:
        assert search(problem, strategy).cost >= best - 1e-9, strategy


@pytest.mark.parametrize("map_id", [m["id"] for m in GRID_MAPS])
def test_bfs_takes_the_fewest_steps(map_id):
    problem = grid(map_id)
    steps = len(search(problem, "bfs").plan)
    for strategy in STRATEGIES:
        assert steps <= len(search(problem, strategy).plan), strategy


@pytest.mark.parametrize("map_id", [m["id"] for m in GRID_MAPS])
def test_a_star_never_looks_at_more_than_dijkstra(map_id):
    """With an admissible, consistent heuristic the guidance cannot hurt."""
    problem = grid(map_id)
    assert len(search(problem, "astar").expanded) <= len(search(problem, "dijkstra").expanded)


@pytest.mark.parametrize("map_id", [m["id"] for m in GRID_MAPS])
def test_heuristic_never_overestimates(map_id):
    """Admissibility, checked against the true cost-to-go from every cell."""
    problem = grid(map_id)
    backwards = GridProblem(problem.rows, problem.goal, problem.goal, problem.diagonal)
    true_cost = {}
    for r in range(problem.height):
        for c in range(problem.width):
            if problem.is_wall((r, c)):
                continue
            sub = GridProblem(problem.rows, (r, c), problem.goal, problem.diagonal)
            res = search(sub, "dijkstra")
            if res.found:
                true_cost[(r, c)] = res.cost
    _ = backwards
    for cell, cost in true_cost.items():
        assert problem.heuristic(cell) <= cost + 1e-9, cell


def test_the_path_never_crosses_a_wall():
    problem = grid("maze")
    for cell in search(problem, "astar").states:
        assert not problem.is_wall(cell)


def test_unreachable_goal_is_reported_not_faked():
    problem = GridProblem(["..#..", "..#..", "..#.."], (1, 0), (1, 4))
    result = search(problem, "astar")
    assert not result.found and result.plan == [] and result.cost == 0.0


def test_diagonals_may_not_cut_a_corner():
    problem = GridProblem([".#", "#."], (0, 0), (1, 1), diagonal=True)
    assert not search(problem, "astar").found


def test_diagonal_costs_more_than_a_straight_step():
    problem = GridProblem(["..", ".."], (0, 0), (1, 1), diagonal=True)
    assert search(problem, "astar").cost == pytest.approx(math.sqrt(2))


# ------------------------------------------------------------------- blocks
@pytest.mark.parametrize("problem_id", [b["id"] for b in BLOCK_PROBLEMS])
@pytest.mark.parametrize("strategy", STRATEGIES)
def test_block_plans_actually_reach_the_goal(problem_id, strategy):
    problem = block_problem(problem_id)
    result = search(problem, strategy)
    assert result.found
    assert problem.is_goal(result.states[-1])


@pytest.mark.parametrize("problem_id", [b["id"] for b in BLOCK_PROBLEMS])
def test_every_precondition_really_held(problem_id):
    """The claim the UI makes for each step, checked for the whole plan."""
    problem = block_problem(problem_id)
    result = search(problem, "astar")
    for i, action in enumerate(result.plan):
        detail = describe_action(action, result.states[i])
        assert all(p["holds"] for p in detail["pre"]), (problem_id, i, detail)


@pytest.mark.parametrize("problem_id", [b["id"] for b in BLOCK_PROBLEMS])
def test_effects_describe_what_actually_changed(problem_id):
    problem = block_problem(problem_id)
    result = search(problem, "astar")
    for i, action in enumerate(result.plan):
        before = set(predicates(result.states[i]))
        after = set(predicates(result.states[i + 1]))
        detail = describe_action(action, result.states[i])
        assert after == (before - set(detail["del"])) | set(detail["add"]), (problem_id, i)


@pytest.mark.parametrize("problem_id", [b["id"] for b in BLOCK_PROBLEMS])
def test_bfs_and_astar_find_equally_short_plans(problem_id):
    problem = block_problem(problem_id)
    assert len(search(problem, "bfs").plan) == len(search(problem, "astar").plan)


def test_no_block_is_ever_lost_or_duplicated():
    problem = block_problem("twotowers")
    result = search(problem, "astar")
    expected = sorted(problem.start.blocks)
    for state in result.states:
        assert sorted(state.blocks) == expected


def test_sussman_needs_six_actions():
    """The anomaly's point: neither goal can simply be done first."""
    assert len(search(block_problem("sussman"), "astar").plan) == 6


def test_goal_naming_an_unknown_block_is_rejected():
    with pytest.raises(ValueError):
        BlocksProblem(State.of([["A"]]), ("on(A, Z)",))
