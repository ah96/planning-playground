/* Boot order matters here, so it is spelled out rather than implied:
 * translations, then presets, then the two controllers, then the chrome, and
 * only once everything is listening do we honour the query string. */
(async function () {
  await window.I18N.load();
  window.I18N.apply();

  let presets;
  try {
    presets = await window.API.presets();
  } catch (err) {
    document.body.insertAdjacentHTML("afterbegin",
      `<p style="color:#c82a2a;padding:12px">Could not reach the planner: ${err.message}</p>`);
    return;
  }

  // ------------------------------------------------------------ chrome
  function selectTab(which) {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("is-active", t.dataset.tab === which));
    document.getElementById("tab-grid").classList.toggle("is-hidden", which !== "grid");
    document.getElementById("tab-blocks").classList.toggle("is-hidden", which !== "blocks");
  }
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.onclick = () => selectTab(tab.dataset.tab);
  });

  function selectLang(code) {
    document.querySelectorAll(".lang").forEach((b) => b.classList.toggle("is-active", b.dataset.lang === code));
    window.I18N.set(code);
  }
  document.querySelectorAll(".lang").forEach((btn) => {
    btn.onclick = () => selectLang(btn.dataset.lang);
  });

  // --------------------------------------------------------- deep links
  // ?map=mud&algos=bfs,astar&run=skip&tab=grid&lang=de
  // Handy for the presenter (one link per scenario) and for the tests.
  const q = new URLSearchParams(location.search);

  if (q.get("lang") === "de") selectLang("de");

  window.GridController.init(presets, {
    map: q.get("map"),
    algos: (q.get("algos") || "").split(",").filter(Boolean),
    run: q.get("tab") === "blocks" ? null : q.get("run"),
  });
  window.BlocksController.init(presets, {
    problem: q.get("problem"),
    run: q.get("tab") === "blocks" ? q.get("run") : null,
  });

  selectTab(q.get("tab") === "blocks" ? "blocks" : "grid");
})();
