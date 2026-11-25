# AI Planning Playground

An interactive demo of what AI planning means, for a lecture, a talk or self-study. It has two tabs and one idea: **a plan is a path through a space of states.**

| Tab | What it teaches |
|---|---|
| **Robot navigation** | Search, and what a heuristic saves. Breadth-first search, Dijkstra, greedy best-first search and A\* plan on the same map. The page replays the order in which each of them looked at the cells, and reports how many cells each one needed. |
| **Blocks world** | What an action is. Every step of the plan shows its preconditions, each one checked against the state it ran in, and the facts it adds and deletes. These three lists are what a PDDL domain file contains. |

The page is in English and German. It runs as a small Flask app, or without a server from one self-contained HTML file.

## Results at a glance

Each preset map makes one point. The last four columns give the number of cells each search looked at.

| Map | The point | BFS | Dijkstra | Greedy | A\* |
|---|---|---|---|---|---|
| The wall with one gap | All four find the same 23-step path, with very different effort. | 299 | 299 | 24 | 24 |
| Mud and water | Costs change the answer. Breadth-first and greedy search cross the water at cost 126, Dijkstra and A\* go around at cost 35. | 309 | 293 | 24 | 162 |
| Office corridor | Greedy search arrives at cost 29.73, where the optimum is 27.49. | 238 | 239 | 28 | 100 |
| The pocket | The goal is in a box whose door faces away. The heuristic points at the wall, and greedy search looks at 67 cells where it needed 24 on the first map. | 281 | 281 | 67 | 152 |
| Maze | Corridors leave few choices, so the heuristic saves little. | 109 | 109 | 43 | 91 |

The block problems, with the length of the plan and the number of states breadth-first search and A\* looked at:

| Problem | The point | Actions | BFS | A\* |
|---|---|---|---|---|
| `swap` | A tower of three blocks is turned upside down. It has to be taken apart first. | 6 | 14 | 8 |
| `sussman` | The Sussman anomaly: whichever of the two goals is achieved first has to be undone again. | 6 | 22 | 17 |
| `unbury` | The goal names one block, and four have to move. | 10 | 116 | 81 |
| `twotowers` | Five blocks, and a large difference between the two searches. | 8 | 524 | 93 |

The numbers were printed by the planner on the date given under "Status".

## Quick start

```bash
git clone https://github.com/ah96/planning-playground.git
cd planning-playground
python -m pip install -r requirements.txt
python app.py            # then open http://127.0.0.1:5000/
```

**Without a server and without an installation:** open `standalone/planning_playground.html` in a browser. The file contains the page, both languages, the presets and the planner in JavaScript. The page asks the network only for two web fonts, Nunito and JetBrains Mono, and the stylesheet names system fonts as the fallback.

## Main commands

| Command | What it does | Time |
|---|---|---|
| `python app.py` | serves the page at `http://127.0.0.1:5000/`. `PORT` sets another port. | until stopped |
| `./run.sh` | checks that Flask is installed, then starts the app. `PYTHON` names the interpreter. | until stopped |
| `python tools/build_standalone.py` | writes `standalone/planning_playground.html` again. Run it after a change in `static/`, `templates/index.html` or `planning/presets.py`, since the file is a copy of these. | |
| `python -m pytest test/ -q` | 85 planner tests and 36 parity tests. It needs `pytest`, which `requirements.txt` does not list. | 2 s for the planner tests |

## Deep links

A link opens one scenario directly, so that no clicking is needed during a lecture:

```
?map=mud&algos=bfs,dijkstra,greedy,astar&run=skip     # costs change the answer, already solved
?map=detour&algos=bfs,astar&run=skip                  # the same path, 12 times the cells
?map=pocket&algos=greedy,astar&run=skip               # the heuristic points at a wall
?tab=blocks&problem=sussman&run=skip                  # the Sussman anomaly
&lang=de                                              # the page in German
```

`run=skip` shows the finished search or plan. Any other value of `run` plans as well: the navigation tab then animates the search from the start, and the blocks tab shows the plan at its first state. Without `run` the page waits for the Plan button.

## Two more things to try

- **Draw your own path.** Drag from the robot to the goal. The page scores the path against the optimum.
- **Drop an obstacle and replan.** The page puts a wall on the middle of the finished path and plans again.

## What is here

```
planning/            the planners, in plain Python with no dependencies
  search.py          BFS, Dijkstra, greedy best-first search and A* in one loop
  gridworld.py       the grid with terrain costs
  blocksworld.py     STRIPS actions: preconditions, add effects, delete effects
  presets.py         the maps and the block problems, each with its lesson in both languages
app.py               Flask: serves the page and returns recordings of searches
templates/           index.html, the markup of the page
static/css/          style.css
static/lang/         en.json and de.json, the texts of the page
static/js/           views and controllers, in JavaScript without a framework
static/js/planner/   core.js, the same planners in JavaScript, for the standalone file
standalone/          planning_playground.html, generated
tools/               build_standalone.py
test/                test_planning.py, test_parity.py
run.sh               starts the app
```

## Ground rules

- **The numbers on screen are the planner's own.** The server sends the order in which the search expanded states, and the browser replays it. No animation and no number is prepared in advance.
- **One source for the presets.** The maps and the block problems are defined in `planning/presets.py` only. The standalone build copies them from there.
- **Two planners, one behaviour.** The planner exists in Python and in JavaScript, because the page runs with and without a server. `test_parity.py` compares the two, down to the order in which states are expanded, since a different order would give a different animation.
- **The standalone file is generated.** It is written by `tools/build_standalone.py` and never edited by hand.

## Tests

`test_planning.py` checks guarantees and not fixed outputs: A\* and Dijkstra agree on the optimal cost, no strategy returns a cheaper path than the optimum, breadth-first search takes the fewest steps, the heuristic never overestimates the true cost from any cell, every precondition the page shows did hold, and the add and delete effects account exactly for the change of state.

`test_parity.py` runs the JavaScript planner in headless Chrome or Chromium over the same presets and compares the results with Python. Without Chrome or Chromium on the path these tests are skipped.

## Status

Done:

- Both tabs, both languages, five maps, four block problems, the standalone file.
- Checked on 2026-11-25 (Ubuntu 24.04, Python 3.12, pytest 9.1): the 85 planner tests pass, and the planner printed the numbers of "Results at a glance". The standalone file was rebuilt on the same day.

Not done:

- The 36 parity tests were skipped in that check, because the machine has neither Chrome nor Chromium.
- No test covers the Flask routes in `app.py` or the views and controllers in `static/js/`.

## Licence

The code is under the BSD 3-Clause licence, see [`LICENSE`](LICENSE). Flask is installed with `pip` and keeps its own licence. The two fonts are loaded from Google Fonts by the browser and are not part of this repository.
