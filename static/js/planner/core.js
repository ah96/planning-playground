/* A JavaScript port of planning/search.py, gridworld.py and blocksworld.py.
 *
 * This exists so the standalone HTML build needs no server.  It is kept
 * deliberately parallel to the Python -- same function names, same order of
 * successors, same tie-breaking -- because test/test_parity.py runs both on
 * every preset and fails if a single number differs.  If you change one side,
 * change the other.
 */
window.Planner = (function () {
  "use strict";

  const STRATEGIES = ["bfs", "dijkstra", "greedy", "astar"];

  // ------------------------------------------------------------------ heap
  // Binary min-heap over [priority, counter, ...]. The minimum is unique
  // because `counter` is unique, so this pops exactly what Python's heapq does.
  class Heap {
    constructor() { this.a = []; }
    get size() { return this.a.length; }
    static less(x, y) { return x[0] !== y[0] ? x[0] < y[0] : x[1] < y[1]; }
    push(item) {
      const a = this.a;
      a.push(item);
      let i = a.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (Heap.less(a[i], a[p])) { const t = a[i]; a[i] = a[p]; a[p] = t; i = p; } else break;
      }
    }
    pop() {
      const a = this.a;
      const top = a[0];
      const last = a.pop();
      if (a.length) {
        a[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < a.length && Heap.less(a[l], a[m])) m = l;
          if (r < a.length && Heap.less(a[r], a[m])) m = r;
          if (m === i) break;
          const t = a[i]; a[i] = a[m]; a[m] = t; i = m;
        }
      }
      return top;
    }
  }

  function priority(strategy, g, h) {
    if (strategy === "dijkstra") return g;
    if (strategy === "greedy") return h;
    return g + h;
  }

  // ---------------------------------------------------------------- search
  function search(problem, strategy, maxExpansions) {
    if (!STRATEGIES.includes(strategy)) throw new Error("unknown strategy " + strategy);
    maxExpansions = maxExpansions || 200000;
    const t0 = (performance && performance.now) ? performance.now() : Date.now();

    const start = problem.initial();
    const startKey = problem.key(start);
    const res = {
      strategy, found: false, plan: [], states: [], cost: 0,
      expanded: [], g: [], frontier: [], generated: 0, maxFrontier: 0, ms: 0,
    };

    const parent = new Map([[startKey, [null, null, start]]]);
    const bestG = new Map([[startKey, 0]]);
    const closed = new Set();
    let counter = 0;

    const fifo = [];
    let fifoHead = 0;                       // index instead of shift(), for O(1)
    const heap = new Heap();
    if (strategy === "bfs") fifo.push([startKey, start, 0]);
    else heap.push([priority(strategy, 0, strategy === "dijkstra" ? 0 : problem.heuristic(start)), counter, startKey, start, 0]);

    while ((strategy === "bfs" ? fifoHead < fifo.length : heap.size > 0)) {
      if (res.expanded.length >= maxExpansions) break;

      let nodeKey, state, g;
      if (strategy === "bfs") {
        const n = fifo[fifoHead++];
        nodeKey = n[0]; state = n[1]; g = n[2];
        if (closed.has(nodeKey)) continue;
      } else {
        const n = heap.pop();
        nodeKey = n[2]; state = n[3]; g = n[4];
        if (closed.has(nodeKey)) continue;
        const best = bestG.has(nodeKey) ? bestG.get(nodeKey) : Infinity;
        if (g > best) continue;
      }

      closed.add(nodeKey);
      res.expanded.push(nodeKey);
      res.g.push(round3(g));
      res.frontier.push(strategy === "bfs" ? (fifo.length - fifoHead) : heap.size);
      if (res.frontier[res.frontier.length - 1] > res.maxFrontier) res.maxFrontier = res.frontier[res.frontier.length - 1];

      if (problem.isGoal(state)) {
        res.found = true;
        const built = reconstruct(parent, nodeKey);
        res.plan = built[0];
        res.states = built[1];
        res.cost = g;
        break;
      }

      const succs = problem.successors(state);
      for (let i = 0; i < succs.length; i++) {
        const action = succs[i][0], succ = succs[i][1], stepCost = succs[i][2];
        const succKey = problem.key(succ);
        res.generated += 1;
        const g2 = g + stepCost;

        if (strategy === "bfs") {
          if (parent.has(succKey)) continue;
          parent.set(succKey, [nodeKey, action, succ]);
          bestG.set(succKey, g2);
          fifo.push([succKey, succ, g2]);
        } else {
          if (closed.has(succKey)) continue;
          const known = bestG.has(succKey) ? bestG.get(succKey) : Infinity;
          if (g2 >= known) continue;
          parent.set(succKey, [nodeKey, action, succ]);
          bestG.set(succKey, g2);
          counter += 1;
          const h = strategy === "dijkstra" ? 0 : problem.heuristic(succ);
          heap.push([priority(strategy, g2, h), counter, succKey, succ, g2]);
        }
      }
    }

    res.ms = Math.round(((performance && performance.now ? performance.now() : Date.now()) - t0) * 100) / 100;
    return res;
  }

  function reconstruct(parent, goalKey) {
    const actions = [], states = [];
    let key = goalKey;
    while (key !== null && key !== undefined) {
      const rec = parent.get(key);
      states.push(rec[2]);
      if (rec[1] !== null && rec[1] !== undefined) actions.push(rec[1]);
      key = rec[0];
    }
    actions.reverse(); states.reverse();
    return [actions, states];
  }

  const round3 = (x) => Math.round(x * 1000) / 1000;

  // ------------------------------------------------------------- gridworld
  const TERRAIN = { ".": 1, ",": 2, "~": 4, "=": 8 };
  const WALL = "#";
  const CHEAPEST = 1;
  const SQRT2 = Math.SQRT2;
  const STRAIGHT = [[-1, 0, "north"], [0, 1, "east"], [1, 0, "south"], [0, -1, "west"]];
  const DIAGONAL = [[-1, 1, "north-east"], [1, 1, "south-east"], [1, -1, "south-west"], [-1, -1, "north-west"]];

  function GridProblem(rows, start, goal, diagonal) {
    const height = rows.length;
    const width = height ? rows[0].length : 0;
    for (const r of rows) if (r.length !== width) throw new Error("every row of the map must have the same width");

    const inBounds = (r, c) => r >= 0 && r < height && c >= 0 && c < width;
    const isWall = (r, c) => rows[r][c] === WALL;
    const costOf = (r, c) => { const t = TERRAIN[rows[r][c]]; return t === undefined ? 1 : t; };

    for (const [name, cell] of [["start", start], ["goal", goal]]) {
      if (!inBounds(cell[0], cell[1])) throw new Error(name + " is outside the map");
      if (isWall(cell[0], cell[1])) throw new Error(name + " sits inside a wall");
    }

    const moves = diagonal ? STRAIGHT.concat(DIAGONAL) : STRAIGHT;

    return {
      rows, start, goal, diagonal, height, width, inBounds, isWall, costOf,
      initial: () => start,
      isGoal: (s) => s[0] === goal[0] && s[1] === goal[1],
      key: (s) => s[0] * width + s[1],          // a number: fast and unique
      successors(s) {
        const out = [];
        const r = s[0], c = s[1];
        for (let i = 0; i < moves.length; i++) {
          const dr = moves[i][0], dc = moves[i][1], name = moves[i][2];
          const nr = r + dr, nc = c + dc;
          if (!inBounds(nr, nc) || isWall(nr, nc)) continue;
          if (dr && dc) {
            if (isWall(r + dr, c) || isWall(r, c + dc)) continue;
            out.push([name, [nr, nc], costOf(nr, nc) * SQRT2]);
          } else {
            out.push([name, [nr, nc], costOf(nr, nc)]);
          }
        }
        return out;
      },
      heuristic(s) {
        const dr = Math.abs(s[0] - goal[0]);
        const dc = Math.abs(s[1] - goal[1]);
        if (diagonal) return CHEAPEST * (Math.abs(dr - dc) + SQRT2 * Math.min(dr, dc));
        return CHEAPEST * (dr + dc);
      },
      pathCost(cells) {
        let total = 0;
        for (let i = 1; i < cells.length; i++) {
          const dr = Math.abs(cells[i][0] - cells[i - 1][0]);
          const dc = Math.abs(cells[i][1] - cells[i - 1][1]);
          if (dr > 1 || dc > 1 || (dr === 0 && dc === 0)) throw new Error("not neighbours");
          const step = costOf(cells[i][0], cells[i][1]);
          total += (dr && dc) ? step * SQRT2 : step;
        }
        return total;
      },
      cellOf: (k) => [Math.floor(k / width), k % width],
    };
  }

  // ------------------------------------------------------------ blocksworld
  // Python compares tuples element-wise, and a prefix sorts first; replicate
  // that exactly or the successor order (and thus the trace) drifts apart.
  function cmpTuple(a, b) {
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
      if (a[i] < b[i]) return -1;
      if (a[i] > b[i]) return 1;
    }
    return a.length - b.length;
  }

  function stateOf(stacks, holding) {
    const clean = stacks.filter((s) => s && s.length).map((s) => s.slice());
    clean.sort(cmpTuple);
    return { stacks: clean, holding: holding === undefined ? null : holding };
  }

  function stateKey(s) {
    return s.stacks.map((st) => st.join("")).join("|") + "/" + (s.holding || "-");
  }

  function predicates(state) {
    const facts = [];
    for (const stack of state.stacks) {
      facts.push(`ontable(${stack[0]})`);
      for (let i = 1; i < stack.length; i++) facts.push(`on(${stack[i]}, ${stack[i - 1]})`);
      facts.push(`clear(${stack[stack.length - 1]})`);
    }
    if (state.holding) facts.push(`holding(${state.holding})`);
    else facts.push("handempty");
    facts.sort();
    return facts;
  }

  function describeAction(action, before) {
    const facts = new Set(predicates(before));
    const a = action.args;
    let pre, add, del;
    if (action.name === "pickup") {
      pre = [`ontable(${a[0]})`, `clear(${a[0]})`, "handempty"];
      add = [`holding(${a[0]})`]; del = [`ontable(${a[0]})`, `clear(${a[0]})`, "handempty"];
    } else if (action.name === "putdown") {
      pre = [`holding(${a[0]})`];
      add = [`ontable(${a[0]})`, `clear(${a[0]})`, "handempty"]; del = [`holding(${a[0]})`];
    } else if (action.name === "unstack") {
      pre = [`on(${a[0]}, ${a[1]})`, `clear(${a[0]})`, "handempty"];
      add = [`holding(${a[0]})`, `clear(${a[1]})`]; del = [`on(${a[0]}, ${a[1]})`, `clear(${a[0]})`, "handempty"];
    } else if (action.name === "stack") {
      pre = [`holding(${a[0]})`, `clear(${a[1]})`];
      add = [`on(${a[0]}, ${a[1]})`, `clear(${a[0]})`, "handempty"]; del = [`holding(${a[0]})`, `clear(${a[1]})`];
    } else throw new Error("unknown action " + action.name);
    return {
      action: { name: action.name, args: a.slice(), text: `${action.name}(${a.join(", ")})` },
      pre: pre.map((f) => ({ fact: f, holds: facts.has(f) })),
      add, del,
    };
  }

  function BlocksProblem(start, goalFacts) {
    const goalSet = new Set(goalFacts);
    return {
      start, goalFacts,
      initial: () => start,
      key: stateKey,
      isGoal(s) {
        const have = new Set(predicates(s));
        for (const f of goalSet) if (!have.has(f)) return false;
        return true;
      },
      successors(s) {
        const out = [];
        if (s.holding === null) {
          for (const stack of s.stacks) {
            const top = stack[stack.length - 1];
            const rest = stack.slice(0, -1);
            const others = s.stacks.filter((x) => x !== stack);
            if (stack.length === 1) {
              out.push([{ name: "pickup", args: [top] }, stateOf(others, top), 1]);
            } else {
              out.push([{ name: "unstack", args: [top, stack[stack.length - 2]] },
                        stateOf(others.concat([rest]), top), 1]);
            }
          }
        } else {
          const x = s.holding;
          out.push([{ name: "putdown", args: [x] }, stateOf(s.stacks.concat([[x]]), null), 1]);
          for (const stack of s.stacks) {
            const target = stack[stack.length - 1];
            const others = s.stacks.filter((y) => y !== stack);
            out.push([{ name: "stack", args: [x, target] },
                      stateOf(others.concat([stack.concat([x])]), null), 1]);
          }
        }
        return out;
      },
      heuristic(s) {
        const have = new Set(predicates(s));
        let n = 0;
        for (const f of goalSet) if (!have.has(f)) n += 1;
        return n;
      },
    };
  }

  return {
    STRATEGIES, search, GridProblem, BlocksProblem,
    stateOf, stateKey, predicates, describeAction, TERRAIN, WALL,
  };
})();
