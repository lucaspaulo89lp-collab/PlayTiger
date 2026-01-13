(function(){
  const el = (id) => document.getElementById(id);

  // Header wallet
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

  // UI
  const board = el("board");
  const modeSel = el("mode");
  const startBtn = el("start");
  const restartBtn = el("restart");
  const cashoutBtn = el("cashout");

  const timeEl = el("time");
  const movesEl = el("moves");
  const pairsEl = el("pairs");
  const pairsTotalEl = el("pairsTotal");
  const rewardEl = el("reward");
  const msgEl = el("msg");
  const recordsEl = el("records");

  // Win modal
  const winModal = el("winModal");
  const winText = el("winText");
  const btnCashout2 = el("btnCashout2");
  const btnCloseWin = el("btnCloseWin");

  btnCloseWin.onclick = () => winModal.classList.remove("is-open");
  btnCashout2.onclick = () => {
    cashoutBtn.click();
    winModal.classList.remove("is-open");
  };

  // Records storage
  const RKEY = "playtiger_memory_records"; // { "4x4": bestSeconds, ... }
  const loadRecords = () => {
    try { return JSON.parse(localStorage.getItem(RKEY) || "{}"); }
    catch { return {}; }
  };
  const saveRecords = (obj) => localStorage.setItem(RKEY, JSON.stringify(obj));

  function renderRecords(){
    const r = loadRecords();
    const rows = [
      ["Fácil (4x4)", r["4x4"]],
      ["Médio (4x5)", r["4x5"]],
      ["Difícil (6x6)", r["6x6"]],
    ];
    recordsEl.innerHTML = "";
    rows.forEach(([name, val]) => {
      const div = document.createElement("div");
      div.className = "record";
      div.innerHTML = `
        <div class="record__name">${name}</div>
        <div class="record__val">${Number.isFinite(val) ? (val + "s") : "—"}</div>
      `;
      recordsEl.appendChild(div);
    });
  }
  renderRecords();

  // Game state
  let running = false;
  let timer = null;
  let seconds = 0;
  let moves = 0;
  let pairs = 0;
  let pairsTotal = 0;
  let earned = 0;

  let first = null;
  let second = null;
  let lock = false;

  const icons = [
    "🐯","🐾","🌟","⚡","🔥","❄️","🌙","🍀","🧠","👑","🎯","🛡️","🗝️","💎","🍯","🧩",
    "🎲","🧨","🚀","🎧","📦","🕹️","🏆","🪙","🌪️","🌋","🌊","🪐","🦾","🦴","🦋","🐉",
    "🦅","🐺","🦈","🦊"
  ];

  function modeConfig(mode){
    if (mode === "4x4") return { rows:4, cols:4 };
    if (mode === "4x5") return { rows:4, cols:5 };
    return { rows:6, cols:6 };
  }

  function shuffle(arr){
    for (let i = arr.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function computeReward(){
    const mode = modeSel.value;
    const baseByMode = { "4x4": 60, "4x5": 90, "6x6": 140 }[mode] || 60;

    const timePenalty = Math.floor(seconds * 0.9);
    const movesPenalty = Math.floor(Math.max(0, moves - pairsTotal) * 2);

    const raw = baseByMode - timePenalty - movesPenalty;
    const bonus = (seconds <= pairsTotal * 4) ? 20 : 0;

    return Math.max(5, Math.min(250, raw + bonus));
  }

  function setBoardGrid(rows, cols){
    board.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  }

  function resetUI(){
    running = false;
    clearInterval(timer);

    seconds = 0;
    moves = 0;
    pairs = 0;
    earned = 0;

    timeEl.textContent = "0s";
    movesEl.textContent = "0";
    pairsEl.textContent = "0";
    rewardEl.textContent = "0";
    msgEl.textContent = "";

    startBtn.disabled = false;
    restartBtn.disabled = true;
    cashoutBtn.disabled = true;

    winModal.classList.remove("is-open");
  }

  function startTimer(){
    clearInterval(timer);
    timer = setInterval(() => {
      seconds += 1;
      timeEl.textContent = seconds + "s";
      if (running) {
        earned = computeReward();
        rewardEl.textContent = String(earned);
      }
    }, 1000);
  }

  function buildDeck(rows, cols){
    const totalCards = rows * cols;
    pairsTotal = totalCards / 2;
    pairsTotalEl.textContent = String(pairsTotal);

    const chosen = icons.slice(0, pairsTotal);
    return shuffle([...chosen, ...chosen].map((icon, idx) => ({
      id: idx + "_" + icon,
      icon,
      matched: false
    })));
  }

  function renderBoard(deck, rows, cols){
    board.innerHTML = "";
    setBoardGrid(rows, cols);

    deck.forEach((cardData) => {
      const btn = document.createElement("button");
      btn.className = "card";
      btn.type = "button";
      btn.setAttribute("aria-label", "Carta");

      btn.innerHTML = `
        <div class="card__inner">
          <div class="face face--front">🐾</div>
          <div class="face face--back">${cardData.icon}</div>
        </div>
      `;

      btn.addEventListener("click", () => onFlip(btn, cardData));
      board.appendChild(btn);

      cardData._el = btn;
    });
  }

  function onFlip(btn, card){
    if (!running || lock) return;
    if (card.matched) return;
    if (btn.classList.contains("is-flipped")) return;

    try{ PlayTigerSFX.flip(); }catch{}

    btn.classList.add("is-flipped");

    if (!first){
      first = { btn, card };
      return;
    }

    second = { btn, card };
    moves += 1;
    movesEl.textContent = String(moves);

    if (first.card.icon === second.card.icon){
      first.card.matched = true;
      second.card.matched = true;

      first.btn.classList.add("is-matched");
      second.btn.classList.add("is-matched");

      pairs += 1;
      pairsEl.textContent = String(pairs);

      try{ PlayTigerSFX.click(); }catch{}
      if (navigator.vibrate) navigator.vibrate(12);

      first = null;
      second = null;

      if (pairs === pairsTotal) finishGame();
      return;
    }

    try{ PlayTigerSFX.error(); }catch{}
    lock = true;
    setTimeout(() => {
      first.btn.classList.remove("is-flipped");
      second.btn.classList.remove("is-flipped");
      first = null;
      second = null;
      lock = false;
    }, 520);
  }

  function finishGame(){
    running = false;
    clearInterval(timer);

    earned = computeReward();
    rewardEl.textContent = String(earned);

    const mode = modeSel.value;
    const r = loadRecords();
    const best = r[mode];

    let isRecord = false;
    if (!Number.isFinite(best) || seconds < best){
      r[mode] = seconds;
      saveRecords(r);
      renderRecords();
      isRecord = true;
    }

    restartBtn.disabled = false;
    cashoutBtn.disabled = false;
    startBtn.disabled = true;

    // stats
    PlayTiger.stats.incGamesPlayed();

    // feedback win
    try{ PlayTigerSFX.win(); }catch{}
    if (navigator.vibrate) navigator.vibrate([18, 30, 18]);

    winText.textContent = isRecord
      ? `Novo recorde! Você venceu em ${seconds}s e ganhou ${earned} TGC.`
      : `Você venceu em ${seconds}s e ganhou ${earned} TGC.`;

    winModal.classList.add("is-open");
    msgEl.textContent = "Partida concluída. Coleta disponível ✅";
  }

  let deck = [];
  function newGame(){
    resetUI();

    const { rows, cols } = modeConfig(modeSel.value);
    if ((rows * cols) % 2 !== 0){
      msgEl.textContent = "Modo inválido (precisa ser par).";
      return;
    }

    deck = buildDeck(rows, cols);
    renderBoard(deck, rows, cols);

    pairsTotalEl.textContent = String(pairsTotal);
    pairsEl.textContent = "0";

    first = null;
    second = null;
    lock = false;

    running = true;
    startBtn.disabled = true;
    restartBtn.disabled = true;
    cashoutBtn.disabled = true;

    earned = computeReward();
    rewardEl.textContent = String(earned);

    startTimer();
    msgEl.textContent = "Boa! Encontre todos os pares.";
  }

  startBtn.addEventListener("click", () => {
    try{ PlayTigerSFX.click(); }catch{}
    newGame();
  });

  restartBtn.addEventListener("click", () => {
    try{ PlayTigerSFX.click(); }catch{}
    startBtn.disabled = false;
    newGame();
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
  });

  modeSel.addEventListener("change", () => {
    const { rows, cols } = modeConfig(modeSel.value);
    setBoardGrid(rows, cols);
    board.innerHTML = "";
    resetUI();
    msgEl.textContent = "Selecione o modo e clique em Iniciar.";
  });

  // init
  modeSel.dispatchEvent(new Event("change"));
})();
