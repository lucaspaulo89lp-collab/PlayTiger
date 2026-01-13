(function(){
  const el = (id) => document.getElementById(id);

  const u = PlayTiger.user.get();
  el("hello").textContent = "Olá, " + u.name;

  const refreshWallet = () => el("walletTGC").textContent = PlayTiger.wallet.getTGC();
  refreshWallet();

  // SFX toggle
  const sfxState = el("sfxState");
  const renderSfx = () => sfxState.textContent = (window.PlayTigerSFX?.isOn?.() ? "ON" : "OFF");
  renderSfx();
  el("sfxToggle").addEventListener("click", () => {
    try { PlayTigerSFX.toggle(); PlayTigerSFX.click(); } catch {}
    renderSfx();
  });

  // Storage
  const KEY = "playtiger_clicker_state";
  const load = () => {
    try{
      return JSON.parse(localStorage.getItem(KEY) || "{}");
    }catch{
      return {};
    }
  };
  const save = (obj) => localStorage.setItem(KEY, JSON.stringify(obj));

  const state = Object.assign({
    focus: 0,
    control: 0,
    energy: 0,
    bestTPS: 0,
    bestReward: 0
  }, load());

  const calcCost = (base, lvl) => Math.floor(base * Math.pow(1.22, lvl));
  const costFocusEl = el("costFocus");
  const costControlEl = el("costControl");
  const costEnergyEl = el("costEnergy");

  const lvlFocusEl = el("lvlFocus");
  const lvlControlEl = el("lvlControl");
  const lvlEnergyEl = el("lvlEnergy");

  const bestTPSEl = el("bestTPS");
  const bestRewardEl = el("bestReward");

  const timeLeftEl = el("timeLeft");
  const clicksEl = el("clicks");
  const tpsEl = el("tps");
  const comboEl = el("combo");
  const rewardEl = el("reward");
  const msgEl = el("msg");

  const startBtn = el("start");
  const cashoutBtn = el("cashout");
  const retryBtn = el("retry");
  const tapBtn = el("tap");
  const floaters = el("floaters");

  // Modal final
  const winModal = el("winModal");
  const winText = el("winText");
  const btnCashout2 = el("btnCashout2");
  const btnCloseWin = el("btnCloseWin");
  btnCloseWin.onclick = () => winModal.classList.remove("is-open");
  btnCashout2.onclick = () => {
    cashoutBtn.click();
    winModal.classList.remove("is-open");
  };

  function renderShop(){
    const cF = calcCost(30, state.focus);
    const cC = calcCost(45, state.control);
    const cE = calcCost(55, state.energy);

    costFocusEl.textContent = String(cF);
    costControlEl.textContent = String(cC);
    costEnergyEl.textContent = String(cE);

    lvlFocusEl.textContent = String(state.focus);
    lvlControlEl.textContent = String(state.control);
    lvlEnergyEl.textContent = String(state.energy);

    bestTPSEl.textContent = (state.bestTPS || 0).toFixed(1);
    bestRewardEl.textContent = String(state.bestReward || 0);
  }
  renderShop();

  // Round state
  let running = false;
  let clicks = 0;
  let seconds = 30;
  let timer = null;

  // combo
  let combo = 1;
  let comboWindowMs = 520;
  let comboTimeout = null;
  let lastTapTs = 0;

  let earned = 0;

  const roundSecondsBase = 30;

  function setUI(){
    timeLeftEl.textContent = String(seconds);
    clicksEl.textContent = String(clicks);
    comboEl.textContent = "x" + String(combo);
    tpsEl.textContent = seconds === 0 ? "0.0" : (clicks / Math.max(1, (roundSecondsBase + state.energy) - seconds)).toFixed(1);
    rewardEl.textContent = String(earned);
  }

  function floater(text, isCombo=false){
    const d = document.createElement("div");
    d.className = "floater" + (isCombo ? " floater--combo" : "");
    d.textContent = text;

    const x = 42 + (Math.random() * 16); // 42%..58%
    const y = 45 + (Math.random() * 10); // 45%..55%
    d.style.left = x + "%";
    d.style.top = y + "%";

    floaters.appendChild(d);
    requestAnimationFrame(() => { /* trigger */ });
    setTimeout(()=>d.remove(), 800);
  }

  function computeRewardFinal(){
    // base pela performance (TPS)
    const dur = roundSecondsBase + state.energy;
    const tps = clicks / Math.max(1, dur);
    const perf = Math.floor(tps * 14); // escala
    const focusBonus = 1 + (state.focus * 0.05);
    const comboBonus = 1 + Math.min(0.35, (combo - 1) * 0.03); // até +35%
    const raw = Math.floor((20 + perf) * focusBonus * comboBonus);
    return Math.max(5, Math.min(260, raw));
  }

  function startRound(){
    running = true;
    clicks = 0;
    earned = 0;

    combo = 1;
    lastTapTs = 0;
    clearTimeout(comboTimeout);

    seconds = roundSecondsBase + state.energy;
    timeLeftEl.textContent = String(seconds);

    startBtn.disabled = true;
    cashoutBtn.disabled = true;
    retryBtn.disabled = true;
    tapBtn.disabled = false;

    msgEl.textContent = "Ritmo constante = combo alto. Vamos!";

    setUI();

    clearInterval(timer);
    timer = setInterval(() => {
      seconds -= 1;
      timeLeftEl.textContent = String(Math.max(0, seconds));

      if (seconds <= 0){
        finishRound();
      }
    }, 1000);
  }

  function finishRound(){
    clearInterval(timer);
    running = false;
    tapBtn.disabled = true;
    retryBtn.disabled = false;
    startBtn.disabled = true;

    earned = computeRewardFinal();
    rewardEl.textContent = String(earned);

    // update records
    const dur = roundSecondsBase + state.energy;
    const tps = clicks / Math.max(1, dur);
    if (tps > (state.bestTPS || 0)) state.bestTPS = tps;
    if (earned > (state.bestReward || 0)) state.bestReward = earned;

    save(state);
    renderShop();

    // stats
    PlayTiger.stats.setBestClickerTPS(tps);
    PlayTiger.stats.incGamesPlayed();

    try{ PlayTigerSFX.win(); }catch{}
    if (navigator.vibrate) navigator.vibrate([18, 30, 18]);

    msgEl.textContent = "Round concluído. Coleta disponível ✅";
    cashoutBtn.disabled = false;

    winText.textContent = `Você fez ${clicks} cliques, ${tps.toFixed(1)} TPS e ganhou ${earned} TGC.`;
    winModal.classList.add("is-open");
  }

  function bumpCombo(){
    const now = Date.now();
    const delta = now - lastTapTs;
    lastTapTs = now;

    // controle aumenta janela (combo dura mais)
    const controlBonus = state.control * 40; // +40ms por nível
    const windowMs = comboWindowMs + controlBonus;

    if (delta <= windowMs){
      combo = Math.min(25, combo + 1);
      if (combo % 5 === 0){
        floater("COMBO " + combo + "!", true);
        try{ PlayTigerSFX.click(); }catch{}
      }
    } else {
      combo = 1;
    }

    clearTimeout(comboTimeout);
    comboTimeout = setTimeout(() => {
      combo = 1;
      comboEl.textContent = "x1";
    }, windowMs + 40);

    comboEl.textContent = "x" + combo;
  }

  tapBtn.addEventListener("click", () => {
    if (!running) return;

    clicks += 1;

    bumpCombo();

    // feedback por clique
    if (clicks % 2 === 0) floater("+1");
    if (clicks % 7 === 0) floater("🔥", true);

    try{ PlayTigerSFX.click(); }catch{}
    if (navigator.vibrate && clicks % 3 === 0) navigator.vibrate(8);

    // reward “preview” (só para motivar)
    earned = Math.floor(computeRewardFinal() * 0.35);
    setUI();
  });

  startBtn.addEventListener("click", () => {
    try{ PlayTigerSFX.click(); }catch{}
    winModal.classList.remove("is-open");
    startRound();
  });

  retryBtn.addEventListener("click", () => {
    try{ PlayTigerSFX.click(); }catch{}
    winModal.classList.remove("is-open");
    startRound();
  });

  cashoutBtn.addEventListener("click", () => {
    if (running) return;
    if (earned <= 0){
      msgEl.textContent = "Sem recompensa para coletar.";
      return;
    }
    PlayTiger.wallet.addTGC(earned);
    refreshWallet();
    msgEl.textContent = `Coletado: +${earned} TGC ✅`;
    earned = 0;
    rewardEl.textContent = "0";
    cashoutBtn.disabled = true;

    try{ PlayTigerSFX.click(); }catch{}
  });

  // compras
  el("buyFocus").addEventListener("click", () => {
    const cost = calcCost(30, state.focus);
    if (PlayTiger.wallet.getTGC() < cost){
      msgEl.textContent = "Saldo insuficiente para Foco.";
      try{ PlayTigerSFX.error(); }catch{}
      return;
    }
    PlayTiger.wallet.addTGC(-cost);
    state.focus += 1;
    save(state);
    refreshWallet();
    renderShop();
    msgEl.textContent = "Foco comprado ✅";
    try{ PlayTigerSFX.click(); }catch{}
  });

  el("buyControl").addEventListener("click", () => {
    const cost = calcCost(45, state.control);
    if (PlayTiger.wallet.getTGC() < cost){
      msgEl.textContent = "Saldo insuficiente para Controle.";
      try{ PlayTigerSFX.error(); }catch{}
      return;
    }
    PlayTiger.wallet.addTGC(-cost);
    state.control += 1;
    save(state);
    refreshWallet();
    renderShop();
    msgEl.textContent = "Controle comprado ✅";
    try{ PlayTigerSFX.click(); }catch{}
  });

  el("buyEnergy").addEventListener("click", () => {
    const cost = calcCost(55, state.energy);
    if (PlayTiger.wallet.getTGC() < cost){
      msgEl.textContent = "Saldo insuficiente para Energia.";
      try{ PlayTigerSFX.error(); }catch{}
      return;
    }
    PlayTiger.wallet.addTGC(-cost);
    state.energy += 1;
    save(state);
    refreshWallet();
    renderShop();
    msgEl.textContent = "Energia comprada ✅";
    try{ PlayTigerSFX.click(); }catch{}
  });

  // init
  setUI();
  tapBtn.disabled = true;
  cashoutBtn.disabled = true;
  retryBtn.disabled = true;
  msgEl.textContent = "Clique em Iniciar para começar o round.";
})();
