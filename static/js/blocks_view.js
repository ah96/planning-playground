/* Drawing the blocks world: stacks on a table, plus the goal as a fact list.
 *
 * Blocks keep a stable colour across every state so the eye can follow one
 * block through the plan; that is the whole trick that makes the animation
 * readable.
 */
window.BlocksView = (function () {
  const PALETTE = ["#004f7c", "#009789", "#c87800", "#c82a2a", "#6b4fa0", "#3f7d20", "#a0522d", "#2f6f8f"];

  function colorFor(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return PALETTE[h % PALETTE.length];
  }

  function create(tableEl, gripperEl, goalEl) {
    /** Draw one state; `moved` highlights the block the last action touched. */
    function showState(state, moved) {
      tableEl.textContent = "";
      const stacks = state.stacks.slice().sort((a, b) => (a[0] || "").localeCompare(b[0] || ""));
      stacks.forEach((stack) => {
        const col = document.createElement("div");
        col.className = "stack";
        stack.forEach((name) => col.appendChild(blockEl(name, name === moved, false)));
        tableEl.appendChild(col);
      });
      if (state.holding) {
        const col = document.createElement("div");
        col.className = "stack";
        col.appendChild(blockEl(state.holding, state.holding === moved, true));
        tableEl.appendChild(col);
      }
      gripperEl.textContent = state.holding
        ? window.I18N.t("gripperHolding", { block: state.holding })
        : window.I18N.t("gripperEmpty");
    }

    function blockEl(name, isMoved, isHeld) {
      const b = document.createElement("div");
      b.className = "block" + (isHeld ? " held" : "") + (isMoved ? " moved" : "");
      b.style.background = colorFor(name);
      b.textContent = name;
      return b;
    }

    /** The goal, with each fact marked satisfied or not in the current state. */
    function showGoal(goalFacts, currentPredicates) {
      const have = new Set(currentPredicates || []);
      goalEl.textContent = "";
      goalFacts.forEach((f) => {
        const d = document.createElement("div");
        d.className = "fact " + (have.has(f) ? "sat" : "unsat");
        d.textContent = (have.has(f) ? "✓ " : "· ") + f;
        goalEl.appendChild(d);
      });
    }

    return { showState, showGoal, colorFor };
  }

  return { create, colorFor };
})();
