/* The blocks tab: play a plan one action at a time and show, for each action,
 * the preconditions it relied on and the facts it added and deleted.
 *
 * That triple -- name, preconditions, effects -- is literally what a PDDL
 * action is, so this tab is the answer to "what does a planner actually read?".
 */
window.BlocksController = (function () {
  const ALGOS = ["bfs", "dijkstra", "greedy", "astar"];

  function init(presets, opts) {
    opts = opts || {};
    const el = {
      select: document.getElementById("blockSelect"),
      algoBoxes: document.getElementById("blockAlgoBoxes"),
      speed: document.getElementById("blockSpeed"),
      now: document.getElementById("blocksNow"),
      gripper: document.getElementById("gripper"),
      goal: document.getElementById("blocksGoal"),
      planList: document.getElementById("planList"),
      detail: document.getElementById("actionDetail"),
      predicates: document.getElementById("predicateList"),
      lesson: document.getElementById("blockLesson"),
      compare: document.getElementById("blocksCompare"),
      message: document.getElementById("blocksMessage"),
      plan: document.getElementById("btnBlockPlan"),
      play: document.getElementById("btnBlockPlay"),
      step: document.getElementById("btnBlockStep"),
      skip: document.getElementById("btnBlockSkip"),
      reset: document.getElementById("btnBlockReset"),
    };

    const problems = presets.blocks;
    let current = problems[0];
    let algo = "astar";
    let plan = null;        // the server's answer
    let index = -1;         // -1 = initial state, k = after action k
    let timer = null;

    const view = window.BlocksView.create(el.now, el.gripper, el.goal);

    // ------------------------------------------------------------- chrome
    function buildChips() {
      el.algoBoxes.textContent = "";
      ALGOS.forEach((a) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip" + (algo === a ? " is-on" : "");
        b.textContent = window.I18N.t(a);
        b.onclick = () => { algo = a; buildChips(); if (plan) runPlan(); };
        el.algoBoxes.appendChild(b);
      });
    }

    function buildSelect() {
      el.select.textContent = "";
      problems.forEach((p) => {
        const o = document.createElement("option");
        o.value = p.id;
        o.textContent = window.I18N.pick(p.name);
        el.select.appendChild(o);
      });
      el.select.value = current.id;
    }

    function loadProblem(id) {
      current = problems.find((p) => p.id === id) || problems[0];
      el.select.value = current.id;             // keep the dropdown in step with deep links
      plan = null;
      index = -1;
      stopTimer();
      el.lesson.textContent = window.I18N.pick(current.lesson);
      const initial = { stacks: current.start.stacks, holding: current.start.holding, predicates: [] };
      view.showState(initial, null);
      view.showGoal(current.goal, []);
      el.planList.textContent = "";
      el.detail.textContent = "";
      el.predicates.textContent = "";
      el.compare.textContent = "";
      say(window.I18N.t("beforePlan"));
      setControls();
    }

    // ----------------------------------------------------------- planning
    async function runPlan() {
      stopTimer();
      el.plan.disabled = true;
      try {
        const data = await window.API.blocksPlan({ preset: current.id, algorithm: algo });
        plan = data;
        index = -1;
        renderPlanList();
        renderCompare();
        showAt(-1);
        say(window.I18N.t("planFound", { n: data.steps.length, expanded: data.expanded }));
        setControls();
      } catch (err) {
        say(err.message, true);
      } finally {
        el.plan.disabled = false;
      }
    }

    // ---------------------------------------------------------- rendering
    function stateAt(k) {
      if (!plan) return null;
      return k < 0 ? plan.initial : plan.steps[k].after;
    }

    function showAt(k) {
      if (!plan) return;
      index = Math.max(-1, Math.min(k, plan.steps.length - 1));
      const state = stateAt(index);
      const moved = index >= 0 ? plan.steps[index].action.args[0] : null;
      view.showState(state, moved);
      view.showGoal(plan.goal, state.predicates);
      renderPredicates(state.predicates);
      renderDetail(index);
      markPlanList();
    }

    function renderPlanList() {
      el.planList.textContent = "";
      plan.steps.forEach((s, i) => {
        const li = document.createElement("li");
        li.textContent = s.action.text;
        li.onclick = () => { stopTimer(); showAt(i); };
        el.planList.appendChild(li);
      });
    }

    function markPlanList() {
      [...el.planList.children].forEach((li, i) => {
        li.classList.toggle("is-current", i === index);
        li.classList.toggle("is-done", i < index);
      });
    }

    function renderDetail(k) {
      el.detail.textContent = "";
      if (k < 0) return;
      const s = plan.steps[k];
      const frag = document.createDocumentFragment();

      const name = document.createElement("div");
      name.className = "act-name";
      name.textContent = `${k + 1}. ${s.action.text}`;
      frag.appendChild(name);

      frag.appendChild(group(window.I18N.t("preLabel"),
        s.pre.map((p) => ({ text: (p.holds ? "✓ " : "✗ ") + p.fact, cls: p.holds ? "sat" : "unsat" }))));
      frag.appendChild(group(window.I18N.t("addLabel"),
        s.add.map((f) => ({ text: "+ " + f, cls: "add" }))));
      frag.appendChild(group(window.I18N.t("delLabel"),
        s["del"].map((f) => ({ text: "− " + f, cls: "del" }))));

      el.detail.appendChild(frag);
    }

    function group(label, items) {
      const box = document.createElement("div");
      const lab = document.createElement("div");
      lab.className = "grp-label";
      lab.textContent = label;
      box.appendChild(lab);
      const facts = document.createElement("div");
      facts.className = "facts";
      items.forEach((it) => {
        const d = document.createElement("div");
        d.className = "fact " + it.cls;
        d.textContent = it.text;
        facts.appendChild(d);
      });
      box.appendChild(facts);
      return box;
    }

    function renderPredicates(list) {
      el.predicates.textContent = "";
      (list || []).forEach((f) => {
        const d = document.createElement("div");
        d.className = "fact";
        d.textContent = f;
        el.predicates.appendChild(d);
      });
    }

    function renderCompare() {
      el.compare.textContent = "";
      const entries = ALGOS.map((a) => [a, plan.compare[a]]).filter(([, v]) => v);
      const max = Math.max(...entries.map(([, v]) => v.expanded), 1);
      entries.forEach(([a, v]) => {
        const row = document.createElement("div");
        row.className = "row";
        row.innerHTML = `<span>${window.I18N.t(a)}</span>
          <span class="bar" style="width:${Math.max(2, (v.expanded / max) * 100)}%;background:${a === algo ? "#009789" : "#004f7c"}"></span>
          <span class="n">${v.expanded}</span>`;
        el.compare.appendChild(row);
      });
    }

    // ---------------------------------------------------------- animation
    function play() {
      stopTimer();
      if (!plan) return;
      if (index >= plan.steps.length - 1) index = -1;
      const delay = 1400 - Number(el.speed.value) * 12;
      timer = setInterval(() => {
        if (index >= plan.steps.length - 1) { stopTimer(); return; }
        showAt(index + 1);
      }, Math.max(140, delay));
      setControls();
    }

    function stopTimer() { if (timer) { clearInterval(timer); timer = null; } setControls(); }

    // ------------------------------------------------------------ helpers
    function say(msg, warn) {
      el.message.textContent = msg || "";
      el.message.classList.toggle("warn", !!warn);
    }
    function setControls() {
      const has = !!plan;
      el.play.disabled = !has;
      el.step.disabled = !has;
      el.skip.disabled = !has;
      el.play.textContent = window.I18N.t(timer ? "btnPause" : "btnPlay");
    }

    // ------------------------------------------------------------- wiring
    el.select.onchange = () => loadProblem(el.select.value);
    el.plan.onclick = runPlan;
    el.play.onclick = () => (timer ? stopTimer() : play());
    el.step.onclick = () => { stopTimer(); showAt(index + 1); };
    el.skip.onclick = () => { stopTimer(); showAt(plan ? plan.steps.length - 1 : -1); };
    el.reset.onclick = () => { stopTimer(); showAt(-1); };

    window.addEventListener("pp:lang", () => {
      buildChips();
      buildSelect();
      el.lesson.textContent = window.I18N.pick(current.lesson);
      if (plan) { renderCompare(); showAt(index); }
      else { say(window.I18N.t("beforePlan")); loadProblem(current.id); }
      setControls();
    });

    buildChips();
    buildSelect();
    loadProblem(opts.problem && problems.some((p) => p.id === opts.problem) ? opts.problem : problems[0].id);
    if (opts.run) runPlan().then(() => { if (opts.run === "skip") showAt(plan ? plan.steps.length - 1 : -1); });
  }

  return { init };
})();
