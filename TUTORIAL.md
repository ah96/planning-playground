# AI Planning Playground: tutorial

For a reader who is new to AI planning. Each section on code names its file. The short version, with the commands, is [`README.md`](README.md).

## Contents

1. The playground in five minutes
2. Terms
3. Why a playground
4. Planning as search
5. The navigation tab: the model and the five maps
6. The blocks tab: the model and the four problems
7. Design choices and their reasons
8. A tour of the code, in reading order
9. Using the page
10. Changing it
11. Tests
12. Sources
13. Open work

## 1. The playground in five minutes

A planner is given three things: where things stand now, what should be true in the end, and what can be done. It answers with a plan, a sequence of actions that leads from the first to the second. The playground shows how a planner finds that sequence, in two small worlds.

In the **navigation tab** a robot stands on a grid map and has to reach a goal cell. Four search strategies plan on the same map. The page replays, cell by cell, which cells each strategy looked at, then draws the path it found and lists the cost of the path and the number of cells that were needed to find it. The strategies return different paths on some maps and need very different numbers of cells on most.

In the **blocks tab** a gripper rearranges lettered blocks on a table. The page plays the plan one action at a time. For each action it shows the conditions that had to hold before, each one checked against the state at that moment, and the facts the action made true and false.

The two tabs make one point from two sides: **a plan is a path through a space of states.** On the grid a state is a cell, so the space of states is the map itself and can be watched. In the blocks world a state is an arrangement of blocks, and the same search runs on it without a change.

## 2. Terms

| Term | Meaning here |
|---|---|
| **State** | One complete situation. On the grid: the cell the robot stands on. In the blocks world: which block lies on which, and what the gripper holds. |
| **Action** | One step that changes the state: a move to a neighbouring cell, or one movement of the gripper. |
| **Cost** | A number per action. The cost of a plan is the sum over its actions. |
| **Goal** | A test on states. On the grid: the goal cell. In the blocks world: a list of facts that must all be true. |
| **Plan** | A sequence of actions that leads from the initial state to a state that passes the goal test. |
| **State space** | All states that can be reached, with the actions between them. A plan is a path in it. |
| **Frontier** | The states the search has reached and not yet looked at. |
| **To look at a state**, also "to expand" | To take the state from the frontier, test it against the goal and work out the states that follow from it. The counts on the page ("cells seen", "states looked at") are counts of this. |
| **g** | The cost of the cheapest way the search has found so far from the initial state to a state. |
| **Heuristic**, **h** | An estimate of the cost that remains from a state to the goal, computed without searching. |
| **Admissible** | Said of a heuristic that never states more than the true remaining cost. |
| **Optimal** | Said of a plan with the lowest possible cost. |
| **Fact** | A statement that is true or false in a state, such as `on(A, B)`. |
| **Precondition** | A fact that must be true before an action may be used. |
| **Add effect**, **delete effect** | The facts an action makes true, and the facts it makes false. |
| **STRIPS** | The Stanford Research Institute Problem Solver, a planner by Fikes and Nilsson (1971). The name is also used for its way of describing an action by preconditions, add effects and delete effects. |
| **PDDL** | The Planning Domain Definition Language, a standard language in which planning problems are written for planners. |

## 3. Why a playground

A plan on a slide is a finished object. It does not show the work behind it, and it does not show why two planners that both "find a path" can differ by a factor of twelve in effort, or by more than a factor of three in the cost of the result. Both differences become visible only when the search is watched.

The playground therefore keeps three things in view at once: the states the search looked at, the plan it returned, and the numbers that describe both. All three come from the planner while the page is used, so that a changed map or a dropped obstacle gives new numbers and not a prepared picture.

## 4. Planning as search

File: `planning/search.py`.

### The problem

The search knows nothing about grids or blocks. It works on anything that offers these five things (the class `Problem`):

| Name | What it gives |
|---|---|
| `initial` | the initial state |
| `is_goal(state)` | whether a state passes the goal test |
| `successors(state)` | for each action that can be used in the state: the action, the state it leads to, and its cost |
| `heuristic(state)` | the estimate h of the remaining cost |
| `key(state)` | a value that is equal for two states exactly when they are the same state |

### The loop

One function, `search`, runs all four strategies. It keeps a frontier that at first holds only the initial state, and repeats:

1. Take one state from the frontier.
2. If it passes the goal test, stop. The plan is read backwards from this state, since the search remembers for every state from which state and by which action it was reached.
3. Otherwise work out its successors. A successor enters the frontier if it was reached for the first time or more cheaply than before.

The search ends without a plan when the frontier is empty. This is how the page knows that a goal is walled off. It also ends without a plan at a limit of 200 000 states.

### The four strategies

The strategies differ in one thing only: which state the frontier hands out next.

| Strategy | Next state from the frontier | What it guarantees | Uses the goal's position |
|---|---|---|---|
| Breadth-first search (`bfs`) | the one that entered first | the fewest actions. The lowest cost only if all actions cost the same. | no |
| Dijkstra (`dijkstra`) | the one with the lowest g | the lowest cost | no |
| Greedy best-first search (`greedy`) | the one with the lowest h | nothing | yes |
| A\* (`astar`) | the one with the lowest g + h | the lowest cost, if the heuristic is admissible | yes |

Read as a sentence each: breadth-first search spreads evenly in the number of steps. Dijkstra spreads evenly in cost. Greedy search runs towards the goal and ignores what the way so far has cost. A\* adds the cost so far and the estimate of the rest, so it prefers states on a cheap way to the goal.

Dijkstra's strategy goes back to Dijkstra (1959) and A\* to Hart, Nilsson and Raphael (1968), see section 12.

Two states can have the same priority. The search then takes the one that entered the frontier first. This rule makes every run repeat exactly, and it is the reason the Python planner and the JavaScript planner can be compared step by step (section 7).

## 5. The navigation tab: the model and the five maps

Files: `planning/gridworld.py`, `planning/presets.py`.

### The model

- **State:** the cell the robot stands on. Every map of the playground has 14 rows and 26 columns.
- **Actions:** a move to the cell to the north, east, south or west. With "Allow diagonal moves" the four diagonal moves are added.
- **Cost:** entering a cell costs what its terrain costs. Leaving a cell is free.

  | Terrain | Character in a map | Cost |
  |---|---|---|
  | floor | `.` | 1 |
  | grass | `,` | 2 |
  | mud | `~` | 4 |
  | water | `=` | 8 |
  | wall | `#` | cannot be entered |

- **Diagonal moves** cost the terrain times the square root of 2, since the way is longer by that factor. A diagonal move is not allowed if one of the two cells beside it is a wall, so that the robot does not cut a corner.
- **Heuristic:** the distance to the goal on an empty map, times the cost of the cheapest terrain, which is 1. Without diagonal moves the distance is the sum of the row difference and the column difference (the Manhattan distance). With diagonal moves it is the octile distance: as many diagonal steps as possible, then straight ones. No real way can be shorter than the way on an empty map, and no cell is cheaper than floor, so the heuristic is admissible. A test checks this from every cell of every map (section 11).

### The five maps

Each map was built to make one point. The table gives, for each strategy, the cells it looked at, the cost of its path and the number of steps.

| Map | | BFS | Dijkstra | Greedy | A\* |
|---|---|---|---|---|---|
| The wall with one gap | cells | 299 | 299 | 24 | 24 |
| | cost | 23 | 23 | 23 | 23 |
| | steps | 23 | 23 | 23 | 23 |
| Mud and water | cells | 309 | 293 | 24 | 162 |
| | cost | 126 | 35 | 126 | 35 |
| | steps | 23 | 35 | 23 | 35 |
| Office corridor | cells | 238 | 239 | 28 | 100 |
| | cost | 28.9 | 27.49 | 29.73 | 27.49 |
| | steps | 25 | 25 | 26 | 25 |
| The pocket | cells | 281 | 281 | 67 | 152 |
| | cost | 26 | 26 | 26 | 26 |
| | steps | 26 | 26 | 26 | 26 |
| Maze | cells | 109 | 109 | 43 | 91 |
| | cost | 42 | 42 | 42 | 42 |
| | steps | 42 | 42 | 42 | 42 |

**The wall with one gap** (`detour`). The robot and the goal are in the same row, and the wall has a gap in that row. All four strategies return the same path of 23 steps. Breadth-first search and Dijkstra look at 299 of the 354 free cells to find it. Greedy search and A\* look at 24, which are exactly the cells of the path. The reason is the heuristic: at the start it says 23, and 23 is the true cost, so the estimate is exact along the whole path. The point of the map: the same answer can cost twelve times the work.

**Mud and water** (`mud`). A lake lies between the robot and the goal, with mud and grass around it. Breadth-first search counts steps and greedy search follows the estimate, so both go straight through the water: 23 steps at a cost of 126. Dijkstra and A\* go around on floor: 35 steps at a cost of 35. The point: once actions have different costs, the shortest path and the cheapest path are different paths.

**Office corridor** (`office`). Rooms, corridors and a patch of grass, with diagonal moves allowed. The optimum costs 27.49, and Dijkstra and A\* find it. Greedy search looks at only 28 cells and arrives at a cost of 29.73. Breadth-first search finds a path of 25 steps, the same number as the optimum, and still pays 28.9, because a diagonal step costs more than a straight one and breadth-first search does not tell them apart. The point: little work and a good result are two separate things.

**The pocket** (`pocket`). The goal lies in a box whose only door is on the far side. The heuristic says 18 at the start, and the true cost is 26, because the estimate does not know about the box. Greedy search follows the estimate to the wall of the box and has to find its way around: 67 cells, where it needed 24 on the first map. Its path is optimal here, which the strategy does not guarantee. The point: a heuristic helps only as far as it is right.

**Maze** (`maze`). Corridors with few branches, 152 free cells. A\* looks at 91 cells and Dijkstra at 109. The point: where the map leaves few choices, an estimate of the direction can save little.

## 6. The blocks tab: the model and the four problems

File: `planning/blocksworld.py`, with the problems in `planning/presets.py`.

### The model

Lettered blocks stand on a table, alone or in stacks. A gripper holds at most one block. A state is described by facts of five kinds:

| Fact | Meaning |
|---|---|
| `ontable(x)` | block x stands on the table |
| `on(x, y)` | block x stands on block y |
| `clear(x)` | nothing stands on block x |
| `holding(x)` | the gripper holds block x |
| `handempty` | the gripper holds nothing |

There are four actions. Each one is described completely by three lists:

| Action | Preconditions | Adds | Deletes |
|---|---|---|---|
| `pickup(x)`: take x from the table | `ontable(x)`, `clear(x)`, `handempty` | `holding(x)` | `ontable(x)`, `clear(x)`, `handempty` |
| `putdown(x)`: put x on the table | `holding(x)` | `ontable(x)`, `clear(x)`, `handempty` | `holding(x)` |
| `unstack(x, y)`: take x from y | `on(x, y)`, `clear(x)`, `handempty` | `holding(x)`, `clear(y)` | `on(x, y)`, `clear(x)`, `handempty` |
| `stack(x, y)`: put x on y | `holding(x)`, `clear(y)` | `on(x, y)`, `clear(x)`, `handempty` | `holding(x)`, `clear(y)` |

This is the STRIPS way of describing an action, and a PDDL domain file contains the same three lists for every action. A planner needs no other knowledge of the world: it may use an action when the preconditions are among the facts of the state, and the next state is the old one without the deleted facts and with the added ones.

Every action costs 1. The goal is a list of facts, for example `on(A, B)` and `on(B, C)`. It says nothing about the other blocks.

The **heuristic** is the number of goal facts that are not yet true. The goals of the four problems consist of facts of the kinds `on` and `ontable`, and an action adds at most one fact of these kinds. At least as many actions as the heuristic states are therefore still needed, so the heuristic is admissible.

### One plan, step by step

The problem `sussman` starts with C on A, and A and B on the table. The goal is `on(A, B)` and `on(B, C)`: a tower with A on top and C at the bottom. The planner returns six actions. The last column is the heuristic after the action.

| Step | Action | The table after it | In the gripper | h |
|---|---|---|---|---|
| | (start) | C on A. B alone. | nothing | 2 |
| 1 | `unstack(C, A)` | A alone. B alone. | C | 2 |
| 2 | `putdown(C)` | A, B and C alone. | nothing | 2 |
| 3 | `pickup(B)` | A alone. C alone. | B | 2 |
| 4 | `stack(B, C)` | A alone. B on C. | nothing | 1 |
| 5 | `pickup(A)` | B on C. | A | 1 |
| 6 | `stack(A, B)` | A on B on C. | nothing | 0 |

The problem is known as the Sussman anomaly, and the table shows why. A planner that works on one goal after the other fails in both orders. If it achieves `on(B, C)` first, B stands on C while C still stands on A, and A cannot be taken out without removing B again. If it achieves `on(A, B)` first, it clears A and puts it on B, and then B cannot be moved without removing A again. The plan above mixes the two goals: steps 1 and 2 prepare `on(A, B)`, steps 3 and 4 achieve `on(B, C)`, and only then steps 5 and 6 achieve `on(A, B)`. For three steps the heuristic stays at 2, although each of them is needed.

### The four problems

| Problem | Start | Goal | Actions | States looked at: BFS | Dijkstra | Greedy | A\* |
|---|---|---|---|---|---|---|---|
| `swap` | a tower with A on B on C | `on(C, B)`, `on(B, A)` | 6 | 14 | 14 | 7 | 8 |
| `sussman` | C on A, B alone | `on(A, B)`, `on(B, C)` | 6 | 22 | 22 | 14 | 17 |
| `unbury` | a tower of five, A on top, E at the bottom | `ontable(E)`, `on(A, E)` | 10 | 116 | 116 | 65 | 81 |
| `twotowers` | B on A, D on C, E alone | `on(A, B)`, `on(B, C)`, `on(C, D)`, `on(D, E)` | 8 | 524 | 524 | 25 | 93 |

- **`swap`** turns a tower upside down. The tower has to be taken apart before it can be built the other way round.
- **`sussman`** is described above.
- **`unbury`** names two facts in its goal and needs ten actions, since four blocks have to leave the tower before A can stand on E. A goal is short, and the plan behind it can be long.
- **`twotowers`** has five blocks. Breadth-first search looks at 524 states, A\* at 93.

In all four problems the four strategies return the same plan. Breadth-first search and Dijkstra look at the same number of states. This is expected where every action costs 1, since the fewest actions and the lowest cost are then the same thing.

## 7. Design choices and their reasons

| Choice | Reason |
|---|---|
| One search loop for four strategies (`planning/search.py`). | The strategies then differ in the order of the frontier and in nothing else, so a difference on screen is a difference of the strategy and not of its implementation. |
| The planner returns a recording: the order in which it looked at states, and the plan. The browser replays it (`app.py`, `static/js/grid_controller.js`). | The animation and the numbers are then what the planner did. Nothing is drawn that was not computed. |
| The planner exists twice, in Python (`planning/`) and in JavaScript (`static/js/planner/core.js`). | The standalone file has to plan without a server. The Python version stays, because it is the one that is read and tested. |
| Both planners list successors in the same order and break ties in the same way. `test/test_parity.py` compares them. | A different order would give a different animation and sometimes a different path of equal cost, and the page would behave differently with and without a server. |
| Maps and block problems are defined in one file, each with its lesson in both languages (`planning/presets.py`). | A preset and the sentence that explains it cannot drift apart, and the server and the standalone file show the same presets. |
| The grid heuristic is scaled by the cheapest terrain and not by an average. | Only then does it never overstate the remaining cost, which A\* needs to stay optimal. |
| A blocks state is stored as sorted stacks plus the held block. The facts are derived from it (`planning/blocksworld.py`). | Two arrangements that differ only in the order of the stacks on the table are then one state, so the search does not look at them twice. |
| Views draw and controllers decide (`grid_view.js` and `grid_controller.js`, `blocks_view.js` and `blocks_controller.js`). A controller never computes a plan. | The page then has one place that asks the planner, and the same views work with the server and with the JavaScript planner. |
| The tests check guarantees, such as "A\* and Dijkstra agree on the cost", and not fixed outputs. | A guarantee still holds after a map is changed or added, so new presets are tested without new test code. |

## 8. A tour of the code, in reading order

**The planners, in Python**

1. `planning/search.py`: the interface `Problem`, the record `SearchResult` and the function `search` with the loop of section 4. `STRATEGIES` names the four strategies.
2. `planning/gridworld.py`: `GridProblem` with terrain costs, moves and the heuristic. `path_cost` scores a path that was drawn by hand. `parse_grid` reads a map from text.
3. `planning/blocksworld.py`: `State`, `Action` and `BlocksProblem`. `predicates` lists the facts of a state. `describe_action` returns the three lists of an action and marks for each precondition whether it held.
4. `planning/presets.py`: `GRID_MAPS` and `BLOCK_PROBLEMS`.

**The server**

5. `app.py`: a Flask app with five routes. `/` serves the page. `/api/presets` returns the maps and block problems. `/api/grid/plan` plans on a map that the browser sends, with one or several strategies. `/api/grid/score` compares a drawn path with the optimum. `/api/blocks/plan` plans a block problem and attaches to every step its three lists and the states before and after.

**The page**

6. `templates/index.html`: the markup of both tabs. `static/css/style.css`: the stylesheet.
7. `static/lang/en.json`, `static/lang/de.json`: all texts of the page, under the same keys. `static/js/i18n.js` switches between them.
8. `static/js/api.js`: the four calls to the server. `static/js/api_local.js`: the same four calls, answered by the JavaScript planner. The rest of the page does not know which of the two it uses.
9. `static/js/planner/core.js`: the three Python planner files again in JavaScript.
10. `static/js/grid_view.js` draws the map, the search and the path, and reports painting. `static/js/grid_controller.js` holds the buttons, the playback and the table of the navigation tab.
11. `static/js/blocks_view.js` draws the blocks and the goal. `static/js/blocks_controller.js` plays the plan and shows the three lists.
12. `static/js/main.js`: the start-up order (texts, presets, the two controllers) and the deep links.

**Build and tests**

13. `tools/build_standalone.py`: writes `standalone/planning_playground.html` from the template, the stylesheet, both languages, the presets and the scripts, with `api_local.js` in the place of `api.js`.
14. `test/test_planning.py`, `test/test_parity.py`: see section 11.

## 9. Using the page

Start it as the README describes: `python app.py` and `http://127.0.0.1:5000/`, or open `standalone/planning_playground.html`. "EN" and "DE" at the top switch the language.

### Navigation tab

| Control | What it does |
|---|---|
| Map | chooses one of the five maps |
| Algorithms | switches each of the four strategies on or off |
| Paint | chooses what a click or a drag on the map sets: the start, the goal, a wall, floor, grass, mud or water. Any change clears the last search. |
| Allow diagonal moves | adds the four diagonal moves |
| Speed | sets how fast the search is replayed |
| Plan | plans with the chosen strategies and replays the search of the last one in the table |
| Race all four | chooses all four strategies and plans |
| Play, Step, Skip to end | replay the search, advance it by one cell, or show the finished search with its path |
| Clear search | removes the search from the map |
| Draw your own path | switches drawing on. Drag from the robot to the goal, and the page reports the cost of the path beside the optimum. |
| Drop an obstacle & replan | puts a wall on the middle of the path and plans again |

The table "What each search had to do" lists, per strategy, the cells seen, the cost, the steps and the time. A click on a row shows the finished search of that strategy on the map. The explored cells are shaded by their g, so that the even spread of Dijkstra and the narrow track of greedy search can be told apart.

### Blocks tab

| Control | What it does |
|---|---|
| Problem | chooses one of the four problems |
| Algorithms | chooses the one strategy that plans |
| Plan | plans and lists the actions under "The plan" |
| Play, Step, Skip to end | play the plan, advance it by one action, or show the final state |
| Clear search | returns to the initial state |

A click on an action in the list shows the state after it. "This action" shows the three lists of the action, with a tick at every precondition that held. "What is true right now" lists the facts of the state. "States looked at, per strategy" compares the four strategies on the problem.

### Deep links

A link can open a scenario directly: `?map=mud&algos=bfs,astar&run=skip`, or `?tab=blocks&problem=sussman&run=skip&lang=de`. The README lists the parameters.

## 10. Changing it

**A new map.** Add an entry to `GRID_MAPS` in `planning/presets.py`: an `id`, a name and a lesson in both languages, the start and the goal as `[row, column]`, whether diagonal moves are allowed, and the rows in the characters of section 5. All rows need the same length.

**A new block problem.** Add an entry to `BLOCK_PROBLEMS`: the stacks from bottom to top, and the goal facts. Write a goal fact exactly as the planner prints it, with a space after the comma: `on(A, B)`. The goal test compares texts, so `on(A,B)` would never count as true.

**A text of the page.** Change it under the same key in `static/lang/en.json` and `static/lang/de.json`.

**The planner.** Make every change in `planning/` and in `static/js/planner/core.js`, and run the parity tests.

After any change in `static/`, `templates/index.html` or `planning/presets.py`, run `python tools/build_standalone.py`. The standalone file is a copy of these files and does not follow them by itself. The tests take their maps and problems from `planning/presets.py`, so a new preset is tested without new test code.

## 11. Tests

```bash
python -m pytest test/ -q
```

`test/test_planning.py` holds 85 tests of the Python planner. For every map: every strategy finds a path from the start to the goal, the reported cost is the cost of the returned path, Dijkstra and A\* agree on the cost, no strategy returns a path cheaper than the optimum, breadth-first search takes the fewest steps, A\* looks at no more cells than Dijkstra, and the heuristic is admissible from every cell. For every block problem: the plan reaches the goal, every precondition held when its action was used, the add and delete effects account exactly for the change of the state, and breadth-first search and A\* return plans of equal length. Single tests cover, among other things, a goal that cannot be reached, diagonal moves at corners, and a goal that names an unknown block.

`test/test_parity.py` holds 36 tests. It runs the JavaScript planner in headless Chrome or Chromium on all maps and block problems with all strategies, and compares the result with Python: the cost, the path, and the order in which the cells were looked at. Without Chrome or Chromium on the path these tests are skipped.

On 2026-11-25 the 85 planner tests passed (Ubuntu 24.04, Python 3.12, pytest 9.1). The parity tests were skipped in that run, because the machine has neither browser. The numbers and plans in this tutorial were printed by the Python planner on the same day.

## 12. Sources

| Reference | Used for |
|---|---|
| Dijkstra (1959), *A note on two problems in connexion with graphs*, Numerische Mathematik 1, 269-271, DOI [10.1007/BF01386390](https://doi.org/10.1007/BF01386390) | the strategy named after its author |
| Hart, Nilsson and Raphael (1968), *A Formal Basis for the Heuristic Determination of Minimum Cost Paths*, IEEE Transactions on Systems Science and Cybernetics 4(2), 100-107, DOI [10.1109/TSSC.1968.300136](https://doi.org/10.1109/TSSC.1968.300136) | A\* |
| Fikes and Nilsson (1971), *STRIPS: A new approach to the application of theorem proving to problem solving*, Artificial Intelligence 2(3-4), 189-208, DOI [10.1016/0004-3702(71)90010-5](https://doi.org/10.1016/0004-3702(71)90010-5) | actions as preconditions, add effects and delete effects |

Title, authors, year and journal of the three references were compared with their records at Crossref on 2026-11-25. The papers themselves were not read for this tutorial. The long forms of STRIPS and PDDL and the name of the Sussman anomaly were compared with the English Wikipedia articles on the same day.

## 13. Open work

- The parity tests have to be run on a machine with Chrome or Chromium after a change to either planner.
- No test covers the Flask routes in `app.py` or the views and controllers in `static/js/`.
- The lessons in `planning/presets.py` and the tables in the README and in this tutorial quote numbers of the planner as text. No test compares them with the planner, so they have to be checked by hand after a change to a map or to the search.
- The blocks tab offers the four problems only. The route `/api/blocks/plan` also accepts stacks and a goal of one's own, and the page has no editor for them.
