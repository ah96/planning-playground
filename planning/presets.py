"""Ready-made maps and block problems, each chosen to make one point.

Nothing here is decoration: every preset is the shortest scenario that shows a
particular lesson, and the blurb travels with it to the UI so the presenter does
not have to remember which is which.
"""

from __future__ import annotations

from .blocksworld import BlocksProblem, State
from .gridworld import parse_grid

__all__ = ["GRID_MAPS", "BLOCK_PROBLEMS", "grid_map", "block_problem"]


# --------------------------------------------------------------------- grids
# '.' floor 1   ',' grass 2   '~' mud 4   '=' water 8   '#' wall
GRID_MAPS: list[dict] = [
    {
        "id": "detour",
        "name": {"en": "The wall with one gap", "de": "Die Wand mit einer Lücke"},
        "lesson": {
            "en": "All four find the same 23-step path. Breadth-first and Dijkstra look at 299 cells to do it; greedy and A* look at 24. Same answer, twelve times the work.",
            "de": "Alle vier finden denselben 23-Schritte-Weg. Breitensuche und Dijkstra sehen sich dafür 299 Felder an, gierige Suche und A* nur 24. Gleiche Antwort, zwölffacher Aufwand.",
        },
        "start": [7, 2], "goal": [7, 25], "diagonal": False,
        "rows": parse_grid(
            """
            ..........................
            ..........................
            ..............#...........
            ..............#...........
            ..............#...........
            ..............#...........
            ..............#...........
            ..........................
            ..............#...........
            ..............#...........
            ..............#...........
            ..............#...........
            ..............#...........
            ..........................
            """
        ),
    },
    {
        "id": "mud",
        "name": {"en": "Mud and water", "de": "Schlamm und Wasser"},
        "lesson": {
            "en": "Now cells cost different amounts. Breadth-first and greedy still count steps and wade straight through the water: 23 steps, cost 126. Dijkstra and A* walk around for cost 35 — the same map, a path three times cheaper.",
            "de": "Jetzt kosten die Felder unterschiedlich viel. Breitensuche und gierige Suche zählen weiter Schritte und waten mitten durchs Wasser: 23 Schritte, Kosten 126. Dijkstra und A* gehen aussen herum für Kosten 35 — dieselbe Karte, ein dreimal billigerer Weg.",
        },
        "start": [7, 2], "goal": [7, 25], "diagonal": False,
        "rows": parse_grid(
            """
            ..........................
            ..........,,,,,,,,,,......
            .........,,~~~~~~~~,,.....
            ........,,~~========~,,...
            .......,,~~==========~,,..
            ......,,~~============~,,.
            ......,~~=============~,,.
            ......,~~=============~,,.
            ......,,~~============~,,.
            .......,,~~==========~,,..
            ........,,~~========~,,...
            .........,,~~~~~~~~,,.....
            ..........,,,,,,,,,,......
            ..........................
            """
        ),
    },
    {
        "id": "office",
        "name": {"en": "Office corridor", "de": "Bürokorridor"},
        "lesson": {
            "en": "An office floor, with diagonal moves allowed. Greedy arrives with cost 29.73 where the optimum is 27.49 — cheap to compute, and wrong. Drop an obstacle into the finished path and replan: that is the moment the robot has to explain itself.",
            "de": "Ein Büroflur, mit erlaubten Diagonalzügen. Die gierige Suche kommt mit Kosten 29,73 an, wo das Optimum 27,49 ist — billig gerechnet und trotzdem falsch. Legen Sie ein Hindernis in den fertigen Weg und planen Sie neu: genau dann muss der Roboter sich erklären.",
        },
        "start": [11, 2], "goal": [2, 24], "diagonal": True,
        "rows": parse_grid(
            """
            ..........................
            ....########....########..
            ....#......#....#.........
            ....#......#....#......,,.
            ....#......######......,,.
            ....#.....................
            ....########.#############
            .............#............
            #########....#............
            ........#....#...####.....
            ........#........#...#....
            .................#...#....
            ########.....#####...#....
            ..........................
            """
        ),
    },
    {
        "id": "pocket",
        "name": {"en": "The pocket", "de": "Die Tasche"},
        "lesson": {
            "en": "The goal sits in a box whose only door is round the back. The heuristic points straight at the wall, so greedy walks into the pocket and has to crawl out again: 67 cells instead of the 24 it needed on the first map. A helpful estimate and a misleading one look identical from the inside.",
            "de": "Das Ziel steckt in einer Kiste, deren einzige Tür hinten liegt. Die Heuristik zeigt direkt auf die Wand, also läuft die gierige Suche in die Tasche und muss wieder heraus: 67 Felder statt der 24 auf der ersten Karte. Eine hilfreiche und eine irreführende Schätzung sehen von innen gleich aus.",
        },
        "start": [7, 2], "goal": [7, 20], "diagonal": False,
        "rows": parse_grid(
            """
            ..........................
            ..........................
            ..........................
            ..........................
            ................#########.
            ................#.......#.
            ................#.......#.
            ................#.......#.
            ................#.......#.
            ................#.......#.
            ................####.#####
            ..........................
            ..........................
            ..........................
            """
        ),
    },
    {
        "id": "maze",
        "name": {"en": "Maze", "de": "Labyrinth"},
        "lesson": {
            "en": "Corridors, so there is barely a choice to make: A* looks at 91 cells where Dijkstra looks at 109. The heuristic has almost nothing left to save. A heuristic helps exactly as much as the map lets it.",
            "de": "Lauter Korridore, also kaum Wahlmöglichkeiten: A* sieht sich 91 Felder an, Dijkstra 109. Der Heuristik bleibt fast nichts zu sparen. Eine Heuristik hilft genau so viel, wie die Karte es zulässt.",
        },
        "start": [1, 1], "goal": [12, 24], "diagonal": False,
        "rows": parse_grid(
            """
            ##########################
            #........#...............#
            #.######.#.#############.#
            #.#....#.#.#...........#.#
            #.#.##.#.#.#.#########.#.#
            #.#.##.#...#.#.......#.#.#
            #.#.##.#####.#.#####.#.#.#
            #...##.......#.#...#.#.#.#
            #.########.###.#.#.#.#.#.#
            #........#.#...#.#.#...#.#
            #.######.#.#.###.#.#####.#
            #.#......#.#.....#.......#
            #.#.######.#############.#
            ##########################
            """
        ),
    },
]


# -------------------------------------------------------------------- blocks
BLOCK_PROBLEMS: list[dict] = [
    {
        "id": "swap",
        "name": {"en": "Turn a tower upside down", "de": "Einen Turm umdrehen"},
        "lesson": {
            "en": "Three blocks, and already six moves: you have to take the tower apart before you can build it the other way round.",
            "de": "Drei Klötze und schon sechs Züge: Der Turm muss erst auseinander, bevor er andersherum wieder aufgebaut werden kann.",
        },
        "start": {"stacks": [["C", "B", "A"]], "holding": None},
        "goal": ["on(C, B)", "on(B, A)"],
    },
    {
        "id": "sussman",
        "name": {"en": "The Sussman anomaly", "de": "Die Sussman-Anomalie"},
        "lesson": {
            "en": "The famous one. Solve on(A,B) first and you must undo it to reach on(B,C); solve on(B,C) first and you must undo that. Taking the goals one at a time cannot work — the planner has to consider them together.",
            "de": "Der Klassiker. Erfüllt man erst on(A,B), muss man es wieder zerstören, um on(B,C) zu erreichen — und umgekehrt. Ziel für Ziel geht hier nicht, der Planer muss sie zusammen betrachten.",
        },
        "start": {"stacks": [["A", "C"], ["B"]], "holding": None},
        "goal": ["on(A, B)", "on(B, C)"],
    },
    {
        "id": "unbury",
        "name": {"en": "Dig out the bottom block", "de": "Den untersten Klotz ausgraben"},
        "lesson": {
            "en": "The goal names one block, but four have to move. This is why a plan is longer than a goal.",
            "de": "Das Ziel nennt einen Klotz, bewegen müssen sich vier. Deshalb ist ein Plan länger als ein Ziel.",
        },
        "start": {"stacks": [["E", "D", "C", "B", "A"]], "holding": None},
        "goal": ["ontable(E)", "on(A, E)"],
    },
    {
        "id": "twotowers",
        "name": {"en": "Two towers into one", "de": "Zwei Türme zu einem"},
        "lesson": {
            "en": "Five blocks is roughly five hundred reachable states. Compare how many breadth-first search looks at against A* with the 'unsatisfied goals' estimate.",
            "de": "Fünf Klötze sind rund fünfhundert erreichbare Zustände. Vergleichen Sie, wie viele davon die Breitensuche ansieht und wie viele A* mit der Schätzung 'offene Ziele'.",
        },
        "start": {"stacks": [["A", "B"], ["C", "D"], ["E"]], "holding": None},
        "goal": ["on(A, B)", "on(B, C)", "on(C, D)", "on(D, E)"],
    },
]


def grid_map(map_id: str) -> dict:
    for entry in GRID_MAPS:
        if entry["id"] == map_id:
            return entry
    raise KeyError(map_id)


def block_problem(problem_id: str) -> BlocksProblem:
    for entry in BLOCK_PROBLEMS:
        if entry["id"] == problem_id:
            return BlocksProblem(
                State.of(entry["start"]["stacks"], entry["start"]["holding"]),
                tuple(entry["goal"]),
            )
    raise KeyError(problem_id)
