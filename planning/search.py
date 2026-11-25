"""Four search strategies behind one loop, instrumented for animation.

The whole point of this file is that breadth-first search, Dijkstra, greedy
best-first search and A* differ in *one* line: which node the frontier hands
back next.  Everything else -- expanding, bookkeeping, reconstructing the plan
-- is identical, so the demo can put the four side by side on the same problem
and let the numbers speak.

    strategy   frontier order     optimal?   uses the goal?
    ---------  -----------------  ---------  --------------
    bfs        insertion (FIFO)   only when all costs are equal
    dijkstra   g(n)               yes        no
    greedy     h(n)               no         yes
    astar      g(n) + h(n)        yes, when h never overestimates

A :class:`Problem` is anything with ``initial``, ``is_goal``, ``successors``,
``heuristic`` and ``key``; :mod:`planning.gridworld` and
:mod:`planning.blocksworld` each provide one.  The result carries the order in
which states were expanded, which is what the browser animates.
"""

from __future__ import annotations

import heapq
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Hashable, Iterable, Protocol

__all__ = ["Problem", "SearchResult", "STRATEGIES", "search"]

STRATEGIES = ("bfs", "dijkstra", "greedy", "astar")

# A failed search still has to return something the UI can draw.
_EMPTY: list = []


class Problem(Protocol):
    @property
    def initial(self) -> Any: ...
    def is_goal(self, state: Any) -> bool: ...
    def successors(self, state: Any) -> Iterable[tuple[Any, Any, float]]: ...
    def heuristic(self, state: Any) -> float: ...
    def key(self, state: Any) -> Hashable: ...


@dataclass
class SearchResult:
    """What one run of :func:`search` produced, including its own history."""

    strategy: str
    found: bool
    plan: list = field(default_factory=list)        # the actions, in order
    states: list = field(default_factory=list)      # initial state, then one per action
    cost: float = 0.0
    expanded: list = field(default_factory=list)    # keys, in the order they came off the frontier
    frontier: list = field(default_factory=list)    # frontier size after each expansion
    generated: int = 0
    max_frontier: int = 0
    seconds: float = 0.0
    # for the grid view: how deep/expensive each expanded state was, so the
    # animation can shade the explored region by g-value
    g_of_expanded: list = field(default_factory=list)

    @property
    def stats(self) -> dict:
        return {
            "strategy": self.strategy,
            "found": self.found,
            "expanded": len(self.expanded),
            "generated": self.generated,
            "maxFrontier": self.max_frontier,
            "planLength": len(self.plan),
            "cost": round(self.cost, 3),
            "ms": round(self.seconds * 1000.0, 2),
        }


def search(problem: Problem, strategy: str = "astar", *, max_expansions: int = 200_000) -> SearchResult:
    """Run one strategy on one problem and record everything worth drawing."""
    if strategy not in STRATEGIES:
        raise ValueError(f"unknown strategy {strategy!r}; expected one of {STRATEGIES}")

    t0 = time.perf_counter()
    start = problem.initial
    start_key = problem.key(start)
    result = SearchResult(strategy=strategy, found=False)

    # parent[key] = (parent_key, action, state) -- enough to walk the plan back
    parent: dict[Hashable, tuple[Hashable | None, Any, Any]] = {start_key: (None, None, start)}
    best_g: dict[Hashable, float] = {start_key: 0.0}
    closed: set[Hashable] = set()
    counter = 0                                   # insertion order, for stable tie-breaks

    fifo: deque = deque()
    heap: list = []
    if strategy == "bfs":
        fifo.append((start_key, start, 0.0))
    else:
        h0 = 0.0 if strategy == "dijkstra" else problem.heuristic(start)
        heapq.heappush(heap, (_priority(strategy, 0.0, h0), counter, start_key, start, 0.0))

    while fifo or heap:
        if len(result.expanded) >= max_expansions:
            break

        if strategy == "bfs":
            node_key, state, g = fifo.popleft()
            if node_key in closed:
                continue
        else:
            _, _, node_key, state, g = heapq.heappop(heap)
            if node_key in closed:
                continue                          # a cheaper copy was already expanded
            if g > best_g.get(node_key, float("inf")):
                continue

        closed.add(node_key)
        result.expanded.append(node_key)
        result.g_of_expanded.append(round(g, 3))
        result.frontier.append(len(fifo) if strategy == "bfs" else len(heap))
        result.max_frontier = max(result.max_frontier, result.frontier[-1])

        if problem.is_goal(state):
            result.found = True
            result.plan, result.states = _reconstruct(parent, node_key)
            result.cost = g
            break

        for action, succ, step_cost in problem.successors(state):
            succ_key = problem.key(succ)
            result.generated += 1
            g2 = g + step_cost

            if strategy == "bfs":
                # BFS never revisits: the first time a state is reached is,
                # by the shape of the wave, also the fewest number of steps.
                if succ_key in parent:
                    continue
                parent[succ_key] = (node_key, action, succ)
                best_g[succ_key] = g2
                fifo.append((succ_key, succ, g2))
            else:
                if succ_key in closed:
                    continue
                if g2 >= best_g.get(succ_key, float("inf")):
                    continue                      # we already know a cheaper way here
                parent[succ_key] = (node_key, action, succ)
                best_g[succ_key] = g2
                counter += 1
                h = 0.0 if strategy == "dijkstra" else problem.heuristic(succ)
                heapq.heappush(heap, (_priority(strategy, g2, h), counter, succ_key, succ, g2))

    result.seconds = time.perf_counter() - t0
    return result


def _priority(strategy: str, g: float, h: float) -> float:
    if strategy == "dijkstra":
        return g
    if strategy == "greedy":
        return h
    return g + h                                  # astar


def _reconstruct(parent: dict, goal_key: Hashable) -> tuple[list, list]:
    """Walk the parent chain back to the start and turn it the right way round."""
    actions: list = []
    states: list = []
    key = goal_key
    while key is not None:
        parent_key, action, state = parent[key]
        states.append(state)
        if action is not None:
            actions.append(action)
        key = parent_key
    actions.reverse()
    states.reverse()
    return actions, states
