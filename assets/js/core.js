/* PlayTiger Core — Local-first, seguro, sem backend (por enquanto) */
(function () {
  const STORAGE_KEYS = {
    TGC: "playtiger_tgc",
    USER: "playtiger_user",
    STATS: "playtiger_stats",
  };

  function safeInt(v, fallback = 0) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : fallback;
  }
  function nowISODate() {
    return new Date().toISOString().slice(0, 10);
  }

  const wallet = {
    getTGC() {
      return safeInt(localStorage.getItem(STORAGE_KEYS.TGC), 0);
    },
    setTGC(amount) {
      const v = Math.max(0, safeInt(amount, 0));
      localStorage.setItem(STORAGE_KEYS.TGC, String(v));
      return v;
    },
    addTGC(amount) {
      return this.setTGC(this.getTGC() + Math.max(0, safeInt(amount, 0)));
    },
    spendTGC(amount) {
      const spend = Math.max(0, safeInt(amount, 0));
      const current = this.getTGC();
      if (current < spend) return { ok: false, message: "Saldo insuficiente." };
      this.setTGC(current - spend);
      return { ok: true, message: "Compra realizada." };
    },
  };

  const user = {
    get() {
      const raw = localStorage.getItem(STORAGE_KEYS.USER);
      if (!raw) return { isLogged: false, name: "Visitante" };
      try {
        const data = JSON.parse(raw);
        return { isLogged: true, name: data.name || "Jogador" };
      } catch {
        return { isLogged: false, name: "Visitante" };
      }
    },
    login(name) {
      const clean = String(name || "").trim().slice(0, 24);
      if (!clean) return { ok: false, message: "Nome inválido." };
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify({ name: clean }));
      return { ok: true, message: "Login realizado." };
    },
    logout() {
      localStorage.removeItem(STORAGE_KEYS.USER);
      return { ok: true, message: "Você saiu." };
    },
  };

  const stats = {
    _read() {
      const raw = localStorage.getItem(STORAGE_KEYS.STATS);
      if (!raw) return { gamesPlayed: 0, clicker: { bestTPS: 0, lastScore: 0 }, lastDaily: null, streak: 0 };
      try { return JSON.parse(raw); } catch { return { gamesPlayed: 0, clicker: { bestTPS: 0, lastScore: 0 }, lastDaily: null, streak: 0 }; }
    },
    _write(data) {
      localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(data));
      return data;
    },
    incGamesPlayed() {
      const s = this._read();
      s.gamesPlayed = (s.gamesPlayed || 0) + 1;
      return this._write(s);
    },
    setClickerResult({ tps, score }) {
      const s = this._read();
      s.clicker = s.clicker || { bestTPS: 0, lastScore: 0 };
      s.clicker.lastScore = safeInt(score, 0);
      s.clicker.bestTPS = Math.max(s.clicker.bestTPS || 0, Number(tps || 0));
      return this._write(s);
    },
    claimDailyBonus() {
      const s = this._read();
      const today = nowISODate();
      if (s.lastDaily === today) return { ok: false, message: "Bônus já resgatado hoje." };

      // streak simples
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      s.streak = (s.lastDaily === yesterday) ? (safeInt(s.streak, 0) + 1) : 1;
      s.lastDaily = today;

      // bônus escalável
      const base = 25;
      const extra = Math.min(25, (s.streak - 1) * 5);
      const bonus = base + extra;

      wallet.addTGC(bonus);
      this._write(s);
      return { ok: true, message: `Bônus diário: +${bonus} TGC ✅ (streak ${s.streak} dia(s))` };
    },
    get() { return this._read(); }
  };

  window.PlayTiger = { wallet, user, stats };
})();
