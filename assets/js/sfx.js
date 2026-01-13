// PlayTiger SFX (leve e premium)
window.PlayTigerSFX = (() => {
  const KEY = "playtiger_sfx";
  const state = { on: (localStorage.getItem(KEY) ?? "1") === "1" };

  // sons curtinhos (você pode trocar depois por arquivos .mp3)
  const beep = (freq=520, dur=0.06, vol=0.04) => {
    if (!state.on) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    setTimeout(() => { o.stop(); ctx.close(); }, dur*1000);
  };

  return {
    isOn: () => state.on,
    toggle: () => {
      state.on = !state.on;
      localStorage.setItem(KEY, state.on ? "1" : "0");
      return state.on;
    },
    click: () => beep(540, .05, .03),
    flip:  () => beep(420, .05, .028),
    win:   () => { beep(660,.06,.04); setTimeout(()=>beep(880,.08,.04),80); },
    error: () => beep(220,.07,.03),
  };
})();
