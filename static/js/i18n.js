/* Tiny translation layer: swap the catalogue, re-stamp every [data-i18n] node.
   The catalogues live in static/lang/*.json for the server build; the
   standalone build inlines them into window.PP_LANGS before this runs. */
window.I18N = (function () {
  let lang = "en";
  let packs = window.PP_LANGS || {};

  async function load() {
    if (packs.en && packs.de) return packs;            // already inlined
    const [en, de] = await Promise.all([
      fetch("static/lang/en.json").then((r) => r.json()),
      fetch("static/lang/de.json").then((r) => r.json()),
    ]);
    packs = { en, de };
    return packs;
  }

  /** Look a key up, with {placeholder} substitution. */
  function t(key, vars) {
    const pack = packs[lang] || {};
    let s = pack[key] != null ? pack[key] : (packs.en && packs.en[key]) || key;
    if (vars) {
      for (const k of Object.keys(vars)) s = s.split("{" + k + "}").join(vars[k]);
    }
    return s;
  }

  /** Pick the right half of a {en, de} object coming from the presets. */
  function pick(obj) {
    if (!obj) return "";
    return obj[lang] != null ? obj[lang] : obj.en;
  }

  function apply(root) {
    (root || document).querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
  }

  function set(next) {
    lang = next;
    apply();
    document.documentElement.lang = next;
    window.dispatchEvent(new CustomEvent("pp:lang", { detail: next }));
  }

  return { load, t, pick, apply, set, get lang() { return lang; } };
})();
