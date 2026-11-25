/* Talks to the Flask planner. The standalone build swaps this file for
   api_local.js, which answers the same four calls from JavaScript instead —
   nothing else in the app knows the difference. */
window.API = (function () {
  async function post(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || ("HTTP " + res.status));
    return data;
  }

  return {
    presets: () => fetch("api/presets").then((r) => r.json()),
    gridPlan: (payload) => post("api/grid/plan", payload),
    gridScore: (payload) => post("api/grid/score", payload),
    blocksPlan: (payload) => post("api/blocks/plan", payload),
  };
})();
