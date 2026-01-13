(function(){
  // ---------- UI ----------
  const el = (id) => document.getElementById(id);
  const hello = el("hello");
  const walletTGC = el("walletTGC");

  const timeLeftEl = el("timeLeft");
  const clicksEl = el("clicks");
  const tpsEl = el("tps");
  const rewardEl = el("reward");
  const msgEl = el("msg");

  const bigBtn = el("bigBtn");
  const startBtn = el("start");
  const restartBtn = el("restart");
  const cashoutBtn = el("cashout");

  const shopEl = el("shop");
  const bestTPSEl = el("bestTPS");
  const gamesPlayedEl = el("gamesPlayed");

  // ---------- Player ----------
  const u = PlayTiger.user.get();
  hello.textContent = "Olá, " + u.name;
  const refreshWallet = () => walletTGC.textContent = PlayTiger.wallet.getTGC();
  refreshWallet();

  // ---------- Save for clicker upgrades ----------
  const UKEY = "playtiger_clicker_upgrades";
  const getUpg = () => {
    try { return JSON.parse(localStorage.getItem(UKEY) || "{}"); }
    catch { return {}; }
  };
  const setUpg = (obj) => localStorage.setItem(UKEY, JSON.stringify(obj));

  const upgrades = {
    // multiplica recompensa final
    multiplier: 1,
    // adiciona segundos (qol)
    extraTime: 0,
    // dá +click power (conta cliques como mais)
    clickPower: 1,
  };

  function loadUpgrades(){
    const saved = getUpg();
    upgrades.multiplier = saved.multiplier || 1;
    upgrades.extraTime = saved.extraTime || 0;
    upgrades.clickPower = saved.clickPower || 1;
  }
  function saveUpgrades(){
    setUpg({ ...upgrades });
  }
  loadUpgrades();

  // ---------- Shop config ----------
  const shopItems = [
    {
      id: "clickPower",
      name: "Garras Mais Fortes",
      desc: "Cada clique conta como +1 (poder de clique).",
      basePrice: 60,
      step: 40,
      max: 6,
      apply(level){ upgrades.clickPower = 1 + level; }
    },
    {
      id: "extraTime",
      name: "Fôlego Extra",
      desc: "Aumenta o tempo do modo por +2s.",
      basePrice: 80,
      step: 60,
      max: 5,
      apply(level){ upgrades.extraTime = level * 2; }
    },
    {
      id: "multiplier",
      name: "Multiplicador de Recompensa",
      desc: "Aumenta recompensa final em +10% por nível.",
      basePrice: 120,
      step: 90,
      max: 8,
      apply(level){ upgrades.multiplier = 1 + (level * 0.10); }
    }
  ];

  function getLevels(){
    const saved = getUpg();
    return saved.levels || { clickPower:0, extraTime:0, multiplier:0 };
  }
  function setLevels(levels){
    const saved = getUpg();
    setUpg({ ...saved, levels, ...upgrades });
  }

  function renderShop(){
    const levels = getLevels();
    shopEl.innerHTML = "";

    shopItems.forEach(item => {
      const lvl = levels[item.id] || 0;
      item.apply(lvl);
      saveUpgrades();

      const price = item.basePrice + (lvl * item.step);
      const disabled = lvl >= item.max;

      const wrap = document.createElement("div");
      wrap.className = "shopitem";

      wrap.innerHTML = `
        <div class="shopitem__top">
          <div>
            <div class="shopitem__name">${item.name}</div>
            <div class="shopitem__desc">${item.desc}</div>
          </div>
          <div class="shopitem__price">${disabled ? "MAX" : price + " TGC"}</div>
        </div>
        <div class="shopitem__actions">
          <span class="pill">Nível: ${lvl}/${item.max}</span>
          <button class="btn btn--primary" ${disabled ? "disabled" : ""}>Comprar</button>
        </div>
      `;

      const btn = wrap.querySelector("button");
      btn.addEventListener("click", () => {
        if (disabled) return;
        const buy = PlayTiger.wallet.spendTGC(price);
        if (!buy.ok){
          msgEl.textContent = buy.message;
          return;
        }
        levels[item.id] = lvl + 1;
        item.apply(levels[item.id]);
        setLevels(levels);
        saveUpgrades();
        refreshWallet();
        msgEl.textContent = `Upgrade comprado: ${item.name} (nível ${levels[item.id]}) ✅`;
        renderShop();
      });

      shopEl.appendChild(wrap);
    });

    // stats
    const s = PlayTiger.stats.get();
    bestTPSEl.textContent = (s.clicker?.bestTPS || 0).toFixed(1);
    gamesPlayedEl.textContent = s.gamesPlayed || 0;
  }

  renderShop();

  // ---------- Game loop ----------
  let running = false;
  let clicks = 0;
  let startTime = 0;
  let duration = 20 + upgrades.extraTime;
  let timer = null;
  let earned = 0;

  function resetUI(){
    running = false;
    clicks = 0;
    earned = 0;
    duration = 20 + upgrades.extraTime;

    timeLeftEl.textContent = String(duration);
    clicksEl.textContent = "0";
    tpsEl.textContent = "0.0";
    rewardEl.textContent = "0";
    msgEl.textContent = "";

    bigBtn.disabled = true;
    restartBtn.disabled = true;
    cashoutBtn.disabled = true;
    bigBtn.querySelector(".bigbtn__hint").textContent = "Aperte “Iniciar”";
  }

  function computeReward(tps){
    // recompensa baseada em habilidade (sem aposta)
    // escala suave, + limites
    const base = Math.floor(Math.max(0, tps) * 6);      // 1 TPS ~ 6 TGC
    const bonus = Math.floor(Math.max(0, clicks) / 25); // bônus por volume
    const raw = base + bonus;
    const mult = upgrades.multiplier;
    return Math.max(0, Math.min(500, Math.floor(raw * mult)));
  }

  function updateLive(){
    const elapsed = (Date.now() - startTime) / 1000;
    const tps = elapsed > 0 ? (clicks / elapsed) : 0;
    tpsEl.textContent = tps.toFixed(1);
    earned = computeReward(tps);
    rewardEl.textContent = String(earned);
  }

  function endGame(){
    running = false;
    clearInterval(timer);

    // stats
    const tps = parseFloat(tpsEl.textContent) || 0;
    PlayTiger.stats.incGamesPlayed();
    PlayTiger.stats.setClickerResult({ tps, score: clicks });

    bigBtn.disabled = true;
    restartBtn.disabled = false;
    cashoutBtn.disabled = false;
    msgEl.textContent = `Fim! Você fez ${clicks} cliques (${tps.toFixed(1)} TPS). Pode coletar ${earned} TGC.`;
  }

  startBtn.addEventListener("click", () => {
    if (running) return;
    resetUI();
    renderShop(); // aplica upgrades (tempo/ multiplicador/ power)
    duration = 20 + upgrades.extraTime;

    running = true;
    clicks = 0;
    startTime = Date.now();

    bigBtn.disabled = false;
    restartBtn.disabled = true;
    cashoutBtn.disabled = true;
    bigBtn.querySelector(".bigbtn__hint").textContent = "Clique o máximo que conseguir!";

    let left = duration;
    timeLeftEl.textContent = String(left);

    timer = setInterval(() => {
      left -= 1;
      timeLeftEl.textContent = String(Math.max(0, left));
      updateLive();
      if (left <= 0) endGame();
    }, 1000);
  });

  restartBtn.addEventListener("click", () => {
    resetUI();
    renderShop();
  });

  bigBtn.addEventListener("click", () => {
    if (!running) return;
    clicks += upgrades.clickPower;
    clicksEl.textContent = String(clicks);
    updateLive();
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
    renderShop();
  });

  // init
  resetUI();
})();
