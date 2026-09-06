/* Vitrine — the two things everything else needs. */

const $ = (id) => document.getElementById(id);

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem('vitrine.' + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('vitrine.' + key, JSON.stringify(value)); }
    catch { /* private window, or storage full — carry on */ }
  }
};
