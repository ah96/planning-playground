/* The navigation tab: wiring, playback and the stats table.
 *
 * One rule keeps this readable — the controller never computes a plan itself.
 * It asks the planner (server or local), gets a recording back, and animates
 * it.  Everything on screen is therefore something the planner actually did.
 */
window.GridController = (function () {
  const ALGOS = ["bfs", "dijkstra", "greedy", "astar"];
  const COLOR = { bfs: "#5a5a5a", dijkstra: "#004f7c", greedy: "#c87800", astar: "#009789" };
  const TOOLS = [
    { id: "start", label: "toolStart", swatch: "#004f7c" },
    { id: "goal", label: "toolGoal", swatch: "#c82a2a" },
    { id: "#", label: "toolWall", swatch: "#44505a" },
    { id: ".", label: "toolFloor", swatch: "#f4f5f6" },
    { id: ",", label: "toolGrass", swatch: "#d8e8c8" },
    { id: "~", label: "toolMud", swatch: "#c9a87a" },
    { id: "=", label: "toolWater", swatch: "#9dc6e0" },
  ];

  function init(presets, opts) {
    opts = opts || {};
    const el = {
      grid: document.getElementById("grid"),
      mapSelect: document.getElementById("mapSelect"),
      algoBoxes: document.getElementById("algoBoxes"),
      toolBoxes: document.getElementById("toolBoxes"),
      diagonal: document.getElementById("diagonalToggle"),
      speed: document.getElementById("speedRange"),
      stats: document.querySelector("#gridStats tbody"),
      lesson: document.getElementById("mapLesson"),
      message: document.getElementById("gridMessage"),
      progress: document.getElementById("gridProgress"),
      plan: document.getElementById("btnPlan"),
      race: document.getElementById("btnRace"),
      play: document.getElementById("btnPlay"),
      step: document.getElementById("btnStep"),
      skip: document.getElementById("btnSkip"),
      reset: document.getElementById("btnReset"),
      draw: document.getElementById("btnDraw"),
      obstacle: document.getElementById("btnObstacle"),
    };

    let maps = presets.grids;
    let current = maps[0];
    let selected = new Set(["astar"]);
    let tool = "#";
    let results = [];            // one recording per algorithm, in ALGOS order
    let shown = null;            // which recording the map is animating
    let frame = 0;
    let timer = null;
    let drawMode = false;
    let userPath = [];

    const view = window.GridView.create(el.grid, {
      onPaint: (cell, isFirst) => handlePaint(cell, isFirst),
      onPaintEnd: () => { if (drawMode) scoreUserPath(); },
    });

    // ------------------------------------------------------------ chrome
    function buildChips() {
      el.algoBoxes.textContent = "";
      ALGOS.forEach((a) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip" + (selected.has(a) ? " is-on" : "");
        b.innerHTML = `<i class="dot" style="background:${COLOR[a]}"></i><span>${window.I18N.t(a)}</span>`;
        b.onclick = () => {
          if (selected.has(a)) { if (selected.size > 1) selected.delete(a); }
          else selected.add(a);
          buildChips();
        };
        el.algoBoxes.appendChild(b);
      });

      el.toolBoxes.textContent = "";
      TOOLS.forEach((tdef) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip tool-chip" + (tool === tdef.id ? " is-on" : "");
        b.innerHTML = `<i class="dot" style="background:${tdef.swatch};border:1px solid #bbb"></i><span>${window.I18N.t(tdef.label)}</span>`;
        b.onclick = () => { tool = tdef.id; buildChips(); };
        el.toolBoxes.appendChild(b);
      });
    }

    function buildMapSelect() {
      el.mapSelect.textContent = "";
      maps.forEach((m) => {
        const o = document.createElement("option");
        o.value = m.id;
        o.textContent = window.I18N.pick(m.name);
        el.mapSelect.appendChild(o);
      });
      el.mapSelect.value = current.id;
    }

    function loadMap(id) {
      current = maps.find((m) => m.id === id) || maps[0];
      el.mapSelect.value = current.id;          // keep the dropdown in step with deep links
      el.diagonal.checked = !!current.diagonal;
      view.setMap(current.rows, current.start, current.goal);
      el.lesson.textContent = window.I18N.pick(current.lesson);
      resetSearch();
    }

    // ------------------------------------------------------------ editing
    function handlePaint(cell, isFirst) {
      if (drawMode) {
        extendUserPath(cell, isFirst);
        return;
      }
      const [r, c] = cell;
      if ((tool === "start" || tool === "goal") && !isFirst) return;
      if (view.applyPaint(r, c, tool)) resetSearch();
    }

    function extendUserPath(cell, isFirst) {
      const [r, c] = cell;
      if (view.isWall(r, c)) return;
      if (isFirst) userPath = [];
      const last = userPath[userPath.length - 1];
      if (last && last[0] === r && last[1] === c) return;
      if (!last && !(r === view.start[0] && c === view.start[1])) return;   // must begin at the robot
      if (last) {
        const dr = Math.abs(r - last[0]);
        const dc = Math.abs(c - last[1]);
        const ok = el.diagonal.checked ? (dr <= 1 && dc <= 1) : (dr + dc === 1);
        if (!ok) return;
      }
      userPath.push([r, c]);
      view.showUserPath(userPath);
    }

    // ----------------------------------------------------------- planning
    function payload(extra) {
      return Object.assign({
        rows: view.rows,
        start: view.start,
        goal: view.goal,
        diagonal: el.diagonal.checked,
      }, extra || {});
    }

    async function runPlan(algorithms) {
      stopTimer();
      setBusy(true);
      try {
        const data = await window.API.gridPlan(payload({ algorithms }));
        results = data.results;
        shown = results[results.length - 1];
        frame = 0;
        renderStats();
        if (!shown.found) {
          say(window.I18N.t("noPath"), true);
          view.clearOverlay();
          setControls();
          return;
        }
        say("");
        play();
      } catch (err) {
        say(err.message, true);
      } finally {
        setBusy(false);
      }
    }

    async function scoreUserPath() {
      try {
        const data = await window.API.gridScore(payload({ path: userPath }));
        if (!data.valid) {
          const key = {
            endpoints: "scoreInvalidEndpoints", wall: "scoreInvalidWall",
            jump: "scoreInvalidJump", empty: "scoreInvalidEmpty",
          }[data.reason] || "scoreInvalidEmpty";
          say(window.I18N.t(key), true);
          return;
        }
        const perfect = Math.abs(data.cost - data.optimal) < 1e-6;
        say(window.I18N.t(perfect ? "scorePerfect" : "scoreValid", {
          cost: fmt(data.cost), optimal: fmt(data.optimal),
        }), false);
      } catch (err) {
        say(err.message, true);
      }
    }

    /** Drop a wall onto the middle of the plan and immediately replan. */
    async function dropObstacle() {
      if (!shown || !shown.found || shown.path.length < 3) return;
      const mid = shown.path[Math.floor(shown.path.length / 2)];
      if (!view.applyPaint(mid[0], mid[1], "#")) return;
      view.flash(mid);
      say(window.I18N.t("pathBlocked"));
      await runPlan([...selected]);
    }

    // ---------------------------------------------------------- animation
    function play() {
      stopTimer();
      if (!shown) return;
      if (frame >= shown.expanded.length) frame = 0;
      const delay = frameDelay();
      timer = setInterval(() => {
        const stride = strideFor();
        frame = Math.min(frame + stride, shown.expanded.length);
        view.showSearch(shown, frame);
        updateProgress();
        if (frame >= shown.expanded.length) { stopTimer(); setControls(); }
      }, delay);
      setControls();
    }

    function stopTimer() { if (timer) { clearInterval(timer); timer = null; } setControls(); }

    // A slow map and a 3000-cell map should both finish in a sane time, so the
    // slider controls cells-per-second rather than frames-per-second.
    function strideFor() {
      const v = Number(el.speed.value);
      return Math.max(1, Math.round((v / 100) ** 2 * 40));
    }
    function frameDelay() { return 16; }

    function stepOnce() {
      stopTimer();
      if (!shown) return;
      frame = Math.min(frame + 1, shown.expanded.length);
      view.showSearch(shown, frame);
      updateProgress();
    }

    function skip() {
      stopTimer();
      if (!shown) return;
      frame = shown.expanded.length;
      view.showSearch(shown, frame);
      updateProgress();
    }

    function resetSearch() {
      stopTimer();
      results = [];
      shown = null;
      frame = 0;
      userPath = [];
      view.clearOverlay();
      renderStats();
      updateProgress();
      say("");
    }

    function updateProgress() {
      if (!shown) { el.progress.textContent = ""; return; }
      el.progress.textContent =
        `${frame} / ${shown.expanded.length} ${window.I18N.t("expandedSoFar")}`;
    }

    // -------------------------------------------------------------- stats
    function renderStats() {
      el.stats.textContent = "";
      if (!results.length) return;
      const costs = results.filter((r) => r.found).map((r) => r.cost);
      const best = Math.min(...costs, Infinity);
      const fewest = Math.min(...results.map((r) => r.expanded.length));

      results.forEach((r) => {
        const tr = document.createElement("tr");
        if (shown === r) tr.className = "is-shown";
        const worse = r.found && r.cost > best + 1e-9;
        tr.innerHTML = `
          <td><span class="algo-name"><i class="dot" style="background:${COLOR[r.strategy]}"></i>${window.I18N.t(r.strategy)}</span>
              <span class="hint">${window.I18N.t(r.strategy + "Hint")}</span></td>
          <td class="num ${r.expanded.length === fewest ? "best" : ""}">${r.expanded.length}</td>
          <td class="num ${worse ? "worst" : (r.found && r.cost === best ? "best" : "")}">${r.found ? fmt(r.cost) : "—"}</td>
          <td class="num">${r.found ? r.planLength : "—"}</td>
          <td class="num">${r.ms} ms</td>`;
        tr.onclick = () => { shown = r; frame = r.expanded.length; view.showSearch(r, frame); updateProgress(); renderStats(); };
        el.stats.appendChild(tr);
      });
    }

    // ------------------------------------------------------------ helpers
    function fmt(x) {
      const s = window.I18N.lang === "de" ? "," : ".";
      return (Math.round(x * 100) / 100).toFixed(2).replace(".", s);
    }
    function say(msg, warn) {
      el.message.textContent = msg || "";
      el.message.classList.toggle("warn", !!warn);
    }
    function setBusy(b) { el.plan.disabled = b; el.race.disabled = b; }
    function setControls() {
      const has = !!shown;
      el.play.disabled = !has;
      el.step.disabled = !has;
      el.skip.disabled = !has;
      el.play.textContent = window.I18N.t(timer ? "btnPause" : "btnPlay");
    }

    // -------------------------------------------------------------- wiring
    el.mapSelect.onchange = () => loadMap(el.mapSelect.value);
    el.diagonal.onchange = () => resetSearch();
    el.plan.onclick = () => runPlan([...selected]);
    el.race.onclick = () => { selected = new Set(ALGOS); buildChips(); runPlan(ALGOS); };
    el.play.onclick = () => (timer ? stopTimer() : play());
    el.step.onclick = stepOnce;
    el.skip.onclick = skip;
    el.reset.onclick = resetSearch;
    el.obstacle.onclick = dropObstacle;
    el.draw.onclick = () => {
      drawMode = !drawMode;
      userPath = [];
      el.draw.classList.toggle("is-on", drawMode);
      el.draw.textContent = window.I18N.t(drawMode ? "btnDrawPathDone" : "btnDrawPath");
      say(drawMode ? window.I18N.t("drawHint") : "");
      if (!drawMode) view.showUserPath([]);
    };

    window.addEventListener("pp:lang", () => {
      buildChips();
      buildMapSelect();
      el.lesson.textContent = window.I18N.pick(current.lesson);
      el.draw.textContent = window.I18N.t(drawMode ? "btnDrawPathDone" : "btnDrawPath");
      renderStats();
      updateProgress();
      setControls();
    });

    buildChips();
    buildMapSelect();
    if (opts.algos && opts.algos.length) { selected = new Set(opts.algos.filter((a) => ALGOS.includes(a))); buildChips(); }
    loadMap(opts.map && maps.some((m) => m.id === opts.map) ? opts.map : maps[0].id);
    setControls();

    // Deep links: ?map=mud&algos=bfs,astar&run=skip lets the presenter jump
    // straight to a scenario (and lets the tests drive the UI headlessly).
    if (opts.run) {
      const done = () => { if (opts.run === "skip") skip(); };
      runPlan([...selected]).then(() => setTimeout(done, 0));
    }
  }

  return { init };
})();
