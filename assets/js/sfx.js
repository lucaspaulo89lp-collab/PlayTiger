// PlayTiger SFX (leve e premium)
window.PlayTigerSFX = (() => {
  const KEY = "playtiger_sfx";
  const state = { on: (localStorage.getItem(KEY) ?? "1") === "1" };

  const ctxFactory = () => new (window.AudioContext || window.webkitAudioContext)();

  const beep = (freq = 520, dur = 0.06, vol = 0.04, type = "sine") => {
    if (!state.on) return;

    const ctx = ctxFactory();
    const o = ctx.createOscillator();
    const g = ctx.createGain();

    o.type = type;
    o.frequency.value = freq;

    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);

    o.connect(g);
    g.connect(ctx.destination);

    o.start();
    o.stop(ctx.currentTime + dur + 0.02);

    setTimeout(() => ctx.close(), Math.ceil((dur + 0.04) * 1000));
  };

  return {
    isOn: () => state.on,
    toggle: () => {
      state.on = !state.on;
      localStorage.setItem(KEY, state.on ? "1" : "0");
      return state.on;
    },
    click: () => beep(560, 0.05, 0.03, "sine"),
    flip:  () => beep(420, 0.05, 0.028, "triangle"),
    win:   () => {
      beep(660, 0.06, 0.04, "sine");
      setTimeout(() => beep(880, 0.08, 0.04, "sine"), 80);
    },
    error: () => beep(220, 0.08, 0.03, "sawtooth"),
  };
})();
