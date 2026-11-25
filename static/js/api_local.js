/* The standalone build's stand-in for api.js.
 *
 * Same four calls, same shapes, same promises — but answered by
 * static/js/planner/core.js in the page instead of by Flask.  Nothing else in
 * the app is aware of which one it is talking to.
 */
window.API = (function () {
  const P = window.Planner;

  function gridProblem(payload) {
    return P.GridProblem(payload.rows, payload.start, payload.goal, !!payload.diagonal);
  }

  function gridResult(problem, res) {
    return {
      strategy: res.strategy,
      found: res.found,
      expanded: res.expanded.map((k) => problem.cellOf(k)),
      g: res.g,
      path: res.states.map((s) => [s[0], s[1]]),
      generated: res.generated,
      maxFrontier: res.maxFrontier,
      planLength: res.plan.length,
      cost: Math.round(res.cost * 1000) / 1000,
      ms: res.ms,
    };
  }

  function stateJson(s) {
    return { stacks: s.stacks.map((x) => x.slice()), holding: s.holding, predicates: P.predicates(s) };
  }

  return {
    presets: async () => window.PP_PRESETS,

    gridPlan: async (payload) => {
      const problem = gridProblem(payload);
      const wanted = payload.algorithms || [payload.algorithm || "astar"];
      const bad = wanted.filter((a) => !P.STRATEGIES.includes(a));
      if (bad.length) throw new Error("unknown algorithm(s): " + bad.join(", "));
      return { results: wanted.map((a) => gridResult(problem, P.search(problem, a))) };
    },

    gridScore: async (payload) => {
      const problem = gridProblem(payload);
      const best = P.search(problem, "astar");
      const optimal = Math.round((best.found ? best.cost : 0) * 1000) / 1000;
      const cells = payload.path || [];
      const same = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];
      if (!cells.length) return { valid: false, reason: "empty", optimal };
      if (!same(cells[0], problem.start) || !same(cells[cells.length - 1], problem.goal)) {
        return { valid: false, reason: "endpoints", optimal };
      }
      if (cells.some((c) => problem.isWall(c[0], c[1]))) return { valid: false, reason: "wall", optimal };
      let cost;
      try { cost = problem.pathCost(cells); } catch (e) { return { valid: false, reason: "jump", optimal }; }
      return {
        valid: true,
        cost: Math.round(cost * 1000) / 1000,
        optimal,
        steps: cells.length - 1,
        optimalSteps: Math.max(best.states.length - 1, 0),
        ratio: optimal ? Math.round((cost / optimal) * 1000) / 1000 : null,
      };
    },

    blocksPlan: async (payload) => {
      const entry = (window.PP_PRESETS.blocks || []).find((b) => b.id === payload.preset);
      if (!entry) throw new Error("unknown problem " + payload.preset);
      const start = P.stateOf(entry.start.stacks, entry.start.holding);
      const problem = P.BlocksProblem(start, entry.goal);
      const strategy = payload.algorithm || "astar";
      if (!P.STRATEGIES.includes(strategy)) throw new Error("unknown algorithm " + strategy);

      const res = P.search(problem, strategy);
      const steps = res.plan.map((action, i) => Object.assign(
        P.describeAction(action, res.states[i]),
        { before: stateJson(res.states[i]), after: stateJson(res.states[i + 1]) }
      ));

      const compare = {};
      P.STRATEGIES.forEach((s) => {
        const r = P.search(problem, s);
        compare[s] = { strategy: s, found: r.found, expanded: r.expanded.length,
                       generated: r.generated, maxFrontier: r.maxFrontier,
                       planLength: r.plan.length, cost: r.cost, ms: r.ms };
      });

      return {
        strategy, found: res.found, expanded: res.expanded.length,
        generated: res.generated, maxFrontier: res.maxFrontier,
        planLength: res.plan.length, cost: res.cost, ms: res.ms,
        goal: entry.goal.slice(),
        initial: stateJson(start),
        steps, compare,
      };
    },
  };
})();
