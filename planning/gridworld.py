"""Robot navigation on a grid with terrain costs.

The state is just the cell the robot stands on, which makes this the smallest
interesting planning problem: you can draw the entire state space on screen and
watch the frontier sweep across it.  Terrain costs are what separates
breadth-first search from Dijkstra -- on a map where every cell costs the same
they find the same path, and the moment mud appears they do not.

Terrain characters (also the map file format):

    ``.`` floor 1    ``,`` grass 2    ``~`` mud 4    ``=`` water 8    ``#`` wall

Entering a cell costs that cell's terrain; leaving it is free.  Diagonal moves
cost ``sqrt(2)`` times the terrain and may not cut a corner between two walls,
which is the usual convention and keeps the drawn path honest.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

__all__ = ["TERRAIN", "WALL", "GridProblem", "parse_grid", "grid_to_rows"]

# character -> cost of stepping onto that cell
TERRAIN: dict[str, float] = {".": 1.0, ",": 2.0, "~": 4.0, "=": 8.0}
WALL = "#"
CHEAPEST = min(TERRAIN.values())

_SQRT2 = math.sqrt(2.0)
_STRAIGHT = ((-1, 0, "north"), (0, 1, "east"), (1, 0, "south"), (0, -1, "west"))
_DIAGONAL = ((-1, 1, "north-east"), (1, 1, "south-east"), (1, -1, "south-west"), (-1, -1, "north-west"))


@dataclass
class GridProblem:
    """A map, a start cell, a goal cell and a movement model."""

    rows: list[str]
    start: tuple[int, int]
    goal: tuple[int, int]
    diagonal: bool = False

    def __post_init__(self) -> None:
        self.height = len(self.rows)
        self.width = len(self.rows[0]) if self.height else 0
        if any(len(r) != self.width for r in self.rows):
            raise ValueError("every row of the map must have the same width")
        for name, cell in (("start", self.start), ("goal", self.goal)):
            if not self.in_bounds(cell):
                raise ValueError(f"{name} {cell} is outside the map")
            if self.is_wall(cell):
                raise ValueError(f"{name} {cell} sits inside a wall")

    # ------------------------------------------------------------------ map
    def in_bounds(self, cell: tuple[int, int]) -> bool:
        r, c = cell
        return 0 <= r < self.height and 0 <= c < self.width

    def is_wall(self, cell: tuple[int, int]) -> bool:
        return self.rows[cell[0]][cell[1]] == WALL

    def cost_of(self, cell: tuple[int, int]) -> float:
        return TERRAIN.get(self.rows[cell[0]][cell[1]], 1.0)

    # -------------------------------------------------------------- problem
    @property
    def initial(self) -> tuple[int, int]:
        return self.start

    def is_goal(self, state: tuple[int, int]) -> bool:
        return state == self.goal

    def key(self, state: tuple[int, int]) -> tuple[int, int]:
        return state

    def successors(self, state):
        r, c = state
        moves = _STRAIGHT + _DIAGONAL if self.diagonal else _STRAIGHT
        for dr, dc, name in moves:
            nxt = (r + dr, c + dc)
            if not self.in_bounds(nxt) or self.is_wall(nxt):
                continue
            if dr and dc:
                # no squeezing diagonally between two wall corners
                if self.is_wall((r + dr, c)) or self.is_wall((r, c + dc)):
                    continue
                yield name, nxt, self.cost_of(nxt) * _SQRT2
            else:
                yield name, nxt, self.cost_of(nxt)

    def heuristic(self, state: tuple[int, int]) -> float:
        """Straight-line-ish distance, scaled by the cheapest possible terrain.

        Multiplying by the cheapest terrain (not the average) is what keeps the
        estimate from ever overstating the true cost, which is the condition
        under which A* stays optimal.
        """
        dr = abs(state[0] - self.goal[0])
        dc = abs(state[1] - self.goal[1])
        if self.diagonal:
            straight, diag = abs(dr - dc), min(dr, dc)
            return CHEAPEST * (straight + _SQRT2 * diag)     # octile
        return CHEAPEST * (dr + dc)                          # Manhattan

    # ------------------------------------------------------------ utilities
    def path_cost(self, cells: list[tuple[int, int]]) -> float:
        """What a given walk costs -- used to score the path a human drew."""
        total = 0.0
        for (r0, c0), (r1, c1) in zip(cells, cells[1:]):
            dr, dc = abs(r1 - r0), abs(c1 - c0)
            if dr > 1 or dc > 1 or (dr == 0 and dc == 0):
                raise ValueError(f"({r0},{c0}) and ({r1},{c1}) are not neighbours")
            step = self.cost_of((r1, c1))
            total += step * _SQRT2 if (dr and dc) else step
        return total

    def with_wall_at(self, cell: tuple[int, int]) -> "GridProblem":
        """A copy of this map with one more wall -- the 'the world changed' button."""
        r, c = cell
        rows = list(self.rows)
        rows[r] = rows[r][:c] + WALL + rows[r][c + 1:]
        return GridProblem(rows, self.start, self.goal, self.diagonal)


def parse_grid(text: str) -> list[str]:
    """Rows from a block of text, ignoring blank lines and ``#!`` comments.

    Surrounding whitespace is stripped per line so maps can be written indented
    inside a Python source file; a space is not a terrain character, and letting
    one through would silently add free cells to the map.
    """
    rows = [line.strip() for line in text.splitlines()]
    rows = [r for r in rows if r and not r.startswith("#!")]
    width = max((len(r) for r in rows), default=0)
    return [r.ljust(width, ".") for r in rows]


def grid_to_rows(cells: list[list[str]]) -> list[str]:
    """The browser sends the map as a 2-D array of characters."""
    return ["".join(row) for row in cells]
