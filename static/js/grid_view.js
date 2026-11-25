/* Drawing and painting the map.
 *
 * The view owns the DOM cells and nothing else: it knows how to render a map,
 * how to overlay a search recording up to step k, and how to report painting
 * gestures.  All decisions about *what* to show live in grid_controller.js.
 */
window.GridView = (function () {
  const TERRAIN = { ".": 1, ",": 2, "~": 4, "=": 8 };

  function create(rootEl, hooks) {
    let rows = [];
    let start = [0, 0];
    let goal = [0, 0];
    let cells = [];             // cells[r][c] -> HTMLElement
    let painting = false;

    // ------------------------------------------------------------- render
    function setMap(nextRows, nextStart, nextGoal) {
      rows = nextRows.slice();
      start = nextStart.slice();
      goal = nextGoal.slice();
      build();
    }

    function build() {
      const h = rows.length;
      const w = rows[0].length;
      rootEl.style.gridTemplateColumns = `repeat(${w}, 1fr)`;
      rootEl.textContent = "";
      cells = [];
      const frag = document.createDocumentFragment();
      for (let r = 0; r < h; r++) {
        const rowCells = [];
        for (let c = 0; c < w; c++) {
          const el = document.createElement("div");
          el.className = "cell";
          el.dataset.t = rows[r][c];
          el.dataset.r = r;
          el.dataset.c = c;
          rowCells.push(el);
          frag.appendChild(el);
        }
        cells.push(rowCells);
      }
      rootEl.appendChild(frag);
      markEndpoints();
    }

    function markEndpoints() {
      cells.forEach((row) => row.forEach((el) => el.classList.remove("start", "goal")));
      cells[start[0]][start[1]].classList.add("start");
      cells[goal[0]][goal[1]].classList.add("goal");
    }

    /** Clear every search overlay but keep terrain, start and goal. */
    function clearOverlay() {
      cells.forEach((row) => row.forEach((el) => {
        el.classList.remove("explored", "frontier", "path", "userpath", "blocked-now");
        el.style.removeProperty("--depth");
      }));
    }

    /**
     * Show a recording up to `k` expansions.
     * `result.g` shades the explored region by how expensive each cell was to
     * reach, which is what makes Dijkstra's even ripple and greedy's narrow
     * beam visible at a glance.
     */
    function showSearch(result, k, opts) {
      const showPath = (opts && opts.showPath) !== false;
      clearOverlay();
      const n = Math.min(k, result.expanded.length);
      const maxG = Math.max(1e-6, ...result.g.slice(0, Math.max(n, 1)));
      for (let i = 0; i < n; i++) {
        const [r, c] = result.expanded[i];
        const el = cells[r][c];
        el.classList.add("explored");
        el.style.setProperty("--depth", (0.18 + 0.62 * (result.g[i] / maxG)).toFixed(3));
      }
      if (n > 0 && n < result.expanded.length) {
        const [r, c] = result.expanded[n - 1];
        cells[r][c].classList.add("frontier");
      }
      if (showPath && n >= result.expanded.length && result.found) {
        result.path.forEach(([r, c]) => cells[r][c].classList.add("path"));
      }
      markEndpoints();
    }

    function showUserPath(pathCells) {
      cells.forEach((row) => row.forEach((el) => el.classList.remove("userpath")));
      pathCells.forEach(([r, c]) => cells[r][c].classList.add("userpath"));
      markEndpoints();
    }

    function flash(cell) {
      const el = cells[cell[0]][cell[1]];
      el.classList.add("blocked-now");
      setTimeout(() => el.classList.remove("blocked-now"), 1600);
    }

    // ------------------------------------------------------------ editing
    function applyPaint(r, c, tool) {
      if (tool === "start") {
        if (rows[r][c] === "#") return false;
        start = [r, c];
      } else if (tool === "goal") {
        if (rows[r][c] === "#") return false;
        goal = [r, c];
      } else {
        // never paint a wall onto the robot or its goal
        if (tool === "#" && ((r === start[0] && c === start[1]) || (r === goal[0] && c === goal[1]))) return false;
        rows[r] = rows[r].slice(0, c) + tool + rows[r].slice(c + 1);
        cells[r][c].dataset.t = tool;
      }
      markEndpoints();
      return true;
    }

    function cellFromEvent(ev) {
      const target = document.elementFromPoint(
        ev.touches ? ev.touches[0].clientX : ev.clientX,
        ev.touches ? ev.touches[0].clientY : ev.clientY
      );
      if (!target || !target.classList.contains("cell")) return null;
      return [Number(target.dataset.r), Number(target.dataset.c)];
    }

    function onDown(ev) {
      const cell = cellFromEvent(ev);
      if (!cell) return;
      ev.preventDefault();
      painting = true;
      hooks.onPaint(cell, true);
    }
    function onMove(ev) {
      if (!painting) return;
      const cell = cellFromEvent(ev);
      if (cell) hooks.onPaint(cell, false);
    }
    function onUp() {
      if (!painting) return;
      painting = false;
      hooks.onPaintEnd();
    }

    rootEl.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    rootEl.addEventListener("touchstart", onDown, { passive: false });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);

    return {
      setMap, clearOverlay, showSearch, showUserPath, flash, applyPaint,
      get rows() { return rows.slice(); },
      get start() { return start.slice(); },
      get goal() { return goal.slice(); },
      terrainAt: (r, c) => TERRAIN[rows[r][c]] || 0,
      isWall: (r, c) => rows[r][c] === "#",
    };
  }

  return { create, TERRAIN };
})();
