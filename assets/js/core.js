(function () {
  const KEY = "playtiger_tgc";

  function safeInt(v, fallback = 0) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : fallback;
  }

  const wallet = {
    getTGC() { return safeInt(localStorage.getItem(KEY), 0); },
    setTGC(v) { localStorage.setItem(KEY, String(Math.max(0, safeInt(v,0)))); },
    addTGC(v) { this.setTGC(this.getTGC() + Math.max(0, safeInt(v,0))); }
  };

  window.PlayTiger = { wallet };
})();
