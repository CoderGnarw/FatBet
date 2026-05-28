const regularSymbols = ["🍒", "🍋", "🔔", "⭐", "💎"];
const scatterSymbol = "🎁";
const wildSymbol = "🃏";

const symbols = [
  "🍒", "🍒", "🍒",
  "🍋", "🍋", "🍋",
  "🔔", "🔔",
  "⭐", "⭐",
  "💎",
  wildSymbol,
  scatterSymbol
];

const symbolMultipliers = {
  "🍒": 5,
  "🍋": 8,
  "🔔": 10,
  "⭐": 15,
  "💎": 25
};

const rows = 3;
const reels = 5;

let coins = 1000;
let displayedCoins = 1000;
let currentUser = "";
let onlinePlayers = 1;
let bet = 50;
let freeSpins = 0;
let currentGrid = [];
let isSpinning = false;

let freeSpinStartCount = 0;
let freeSpinTotalWin = 0;

let autoSpinsRemaining = 0;
let autoSpinInfinite = false;
let autoSpinRunning = false;

let turboSpin = false;
let knownFeedIds = [];

let currentStats = null;
let achievementsCache = [];
let selectedTitle = null;

let displayedJackpot = 0;
let jackpotPollInterval = null;

let pendingLootboxResult = null;
let lootboxCanClose = false;

let sevenTvEmotes = {};
const manualEmotes = {
  KEKW: "https://cdn.7tv.app/emote/60ae7316f7c927fad14e6ca2/2x.webp",
  OMEGALUL: "https://cdn.7tv.app/emote/60ae958e229664e8664adbc8/2x.webp"
};

const paylines = [
  [0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 1, 1, 1, 0],
  [2, 1, 1, 1, 2]
];

const spinSound = new Audio("assets/sounds/spin.mp3");
const winSound = new Audio("assets/sounds/win.mp3");
const jackpotSound = new Audio("assets/sounds/jackpot.mp3");
const bigWinSound = new Audio("assets/sounds/bigwin.mp3");
const megaWinSound = new Audio("assets/sounds/megawin.mp3");
const fatWinSound = new Audio("assets/sounds/fatwin.mp3");
const jackpotWinSound = new Audio("assets/sounds/jackpotwin.mp3");

const lootboxSounds = {
  common: new Audio("assets/sounds/common.mp3"),
  rare: new Audio("assets/sounds/rare.mp3"),
  epic: new Audio("assets/sounds/epic.mp3"),
  legendary: new Audio("assets/sounds/legendary.mp3"),
  mythic: new Audio("assets/sounds/mythic.mp3")
};

spinSound.volume = 0.25;
winSound.volume = 0.2;
jackpotSound.volume = 0.25;
bigWinSound.volume = 0.4;
megaWinSound.volume = 0.45;
fatWinSound.volume = 0.55;
jackpotWinSound.volume = 0.7;

window.addEventListener("DOMContentLoaded", async () => {
  createSlotGrid();
  fillGridWithRandomSymbols();
  updateUI();
  updateOnlinePlayers();

  await checkLogin();
  startPresenceSystem();
  await loadJackpot();
  startJackpotPolling();

  await load7TVEmotes();
  await loadChatMessages();
  setInterval(loadChatMessages, 3000);

  await loadLiveFeed();
  await loadAchievements();

  setInterval(loadLiveFeed, 5000);
  setInterval(updateFeedTimes, 1000);
});

async function checkLogin() {
  const res = await fetch("/me", {
    credentials: "include"
  });

  const user = await res.json();
  const profileWrapper = document.getElementById("profileMenuWrapper");

  if (!user) {
    document.getElementById("login").classList.remove("hidden");
    document.getElementById("game").classList.add("hidden");

    if (profileWrapper) profileWrapper.classList.add("hidden");
    return;
  }

  currentUser = user.display_name || user.username;
  coins = user.coins;
  displayedCoins = coins;

  document.getElementById("login").classList.add("hidden");
  document.getElementById("game").classList.remove("hidden");

  if (profileWrapper) profileWrapper.classList.remove("hidden");

  updateProfileUI(user);

  currentStats = {
    spins_total: user.spins_total || 0,
    wins_total: user.wins_total || 0,
    coins_won_total: user.coins_won_total || 0,
    biggest_win: user.biggest_win || 0,
    jackpots_won: user.jackpots_won || 0,
    free_spins_won: user.free_spins_won || 0
  };

  updateUI();
  updateLeaderboard();
  updateStatsUI(currentStats);
  checkAdminPanel();
}

function createSlotGrid() {
  const slotGrid = document.getElementById("slotGrid");
  if (!slotGrid) return;

  slotGrid.innerHTML = "";

  for (let row = 0; row < rows; row++) {
    for (let reel = 0; reel < reels; reel++) {
      const cell = document.createElement("div");
      cell.classList.add("slot");
      cell.id = `slot-${row}-${reel}`;
      cell.innerText = "❓";
      slotGrid.appendChild(cell);
    }
  }
}

function fillGridWithRandomSymbols() {
  currentGrid = [];

  for (let row = 0; row < rows; row++) {
    currentGrid[row] = [];

    for (let reel = 0; reel < reels; reel++) {
      const symbol = rand();
      currentGrid[row][reel] = symbol;

      const cell = document.getElementById(`slot-${row}-${reel}`);
      if (cell) cell.innerText = symbol;
    }
  }
}

function changeBet() {
  if (freeSpins > 0 || isSpinning) {
    const betSelect = document.getElementById("betSelect");
    if (betSelect) betSelect.value = bet;
    return;
  }

  bet = Number(document.getElementById("betSelect").value);
  updateUI();
}

async function spin() {
  if (isSpinning) return;

  clearWinningCells();

  const isFreeSpin = freeSpins > 0;
  const freeSpinsBeforeSpin = freeSpins;

  if (!isFreeSpin && coins < bet) {
    result("Nicht genug Coins!");
    stopAutoSpin();
    return;
  }

  isSpinning = true;
  updateUI();

  if (isFreeSpin) {
    freeSpins--;
    result(`Freispiel läuft 🎁 Noch ${freeSpins} übrig`);
  } else {
    coins -= bet;
  }

  updateUI();

  spinSound.currentTime = 0;
  spinSound.playbackRate = turboSpin ? 1.8 : 0.9;
  spinSound.play().catch(() => {});

  generateFinalGrid(isFreeSpin);
  await animateReelsSequentially();
  renderGrid();

  const winData = calculateTotalWin();
  const scatterData = calculateScatterBonus(isFreeSpin);

  let totalWin = winData.totalWin;

  const jackpotData = await rollJackpot(isFreeSpin);

  if (jackpotData.jackpotWon) {
    totalWin += jackpotData.jackpotWin;
    showJackpotOverlay(jackpotData.jackpotWin);

    await addLiveFeedMessage(
      `${currentUser} hat den Jackpot mit ${formatNumber(jackpotData.jackpotWin)} Coins geknackt 💰`
    );
  }

  if (isFreeSpin && totalWin > 0) {
    freeSpinTotalWin += totalWin;
  }

  if (!isFreeSpin && scatterData.freeSpinsWon > 0) {
  freeSpins += scatterData.freeSpinsWon;
  freeSpinStartCount = scatterData.freeSpinsWon;
  freeSpinTotalWin = 0;

  await showFreeSpinsWonAnimation(scatterData.freeSpinsWon);
  }

  if (totalWin > 0) {
    coins += totalWin;
    highlightWinningLines(winData.winningLines);

    if (winData.hasFiveOfAKind || jackpotData.jackpotWon) {
      playSound(jackpotSound);
    } else {
      playSound(winSound);
    }
  }

  if (totalWin >= bet * 25) {
  const multiplier = totalWin / bet;

  let winTier = "big";

  if (multiplier >= 100) {
    winTier = "fat";
  } else if (multiplier >= 50) {
    winTier = "mega";
  }

  await addLiveFeedMessage({
    message: `${currentUser} gewann ${formatNumber(totalWin)} Coins 🎉`,
    tier: winTier
  });
}

  await updateStats(totalWin, scatterData.freeSpinsWon, jackpotData.jackpotWon);

  highlightScatters();
  showWinDetails(winData.winningLines, scatterData);

  if (totalWin > 0 && scatterData.freeSpinsWon > 0) {
    result(`Gewonnen: ${formatNumber(totalWin)} Coins 🎉 + ${scatterData.freeSpinsWon} Freispiele 🎁`);
  } else if (totalWin > 0) {
    const totalMultiplier = totalWin / bet;
    result(`Gewonnen: ${formatNumber(totalWin)} Coins 🎉 | Gesamt x${totalMultiplier}`);
  } else if (scatterData.freeSpinsWon > 0) {
  result("");
  }
    else {
    result("Leider verloren 😢");
  }

  await save();

  isSpinning = false;
  updateUI();

  if (isFreeSpin && freeSpinsBeforeSpin === 1 && freeSpins === 0) {
    showFreeSpinSummary();
  }

  await showBigWin(totalWin);
}

function animateReelsSequentially() {
  return new Promise(resolve => {
    let stoppedReels = 0;

    for (let reel = 0; reel < reels; reel++) {
      const reelSpinSpeed = turboSpin ? 34 : 72;
      const baseStopTime = turboSpin ? 520 : 950;
      const reelDelay = turboSpin ? 120 : 260;

      const interval = setInterval(() => {
        for (let row = 0; row < rows; row++) {
          const cell = document.getElementById(`slot-${row}-${reel}`);

          cell.classList.add("spinning");
          cell.classList.remove("reel-stop");
          cell.classList.remove("reel-snap");

          cell.innerText = rand();
        }
      }, reelSpinSpeed);

      setTimeout(() => {
        clearInterval(interval);

        for (let row = 0; row < rows; row++) {
          const cell = document.getElementById(`slot-${row}-${reel}`);
          const finalSymbol = currentGrid[row][reel];

          cell.innerText = finalSymbol;
          cell.classList.remove("spinning");

          highlightSpecialSymbolCell(cell, finalSymbol);

          cell.classList.add("reel-stop");
          cell.classList.add("reel-snap");

          setTimeout(() => {
            cell.classList.remove("reel-stop");
            cell.classList.remove("reel-snap");
          }, 420);
        }

        stoppedReels++;

        if (stoppedReels === reels) {
          setTimeout(resolve, turboSpin ? 140 : 260);
        }
      }, baseStopTime + reel * reelDelay);
    }
  });
}

function generateFinalGrid(isFreeSpin = false) {
  currentGrid = [];

  for (let row = 0; row < rows; row++) {
    currentGrid[row] = [];
  }

  for (let reel = 0; reel < reels; reel++) {
    let scatterPlacedOnThisReel = false;

    for (let row = 0; row < rows; row++) {
      let symbol = isFreeSpin ? randRegularOrWildSymbol() : rand();

      if (!isFreeSpin && symbol === scatterSymbol) {
        if (scatterPlacedOnThisReel) {
          symbol = randRegularOrWildSymbol();
        } else {
          scatterPlacedOnThisReel = true;
        }
      }

      currentGrid[row][reel] = symbol;
    }
  }
}

function renderGrid() {
  for (let row = 0; row < rows; row++) {
    for (let reel = 0; reel < reels; reel++) {
      const cell = document.getElementById(`slot-${row}-${reel}`);

      cell.innerText = currentGrid[row][reel];
      cell.classList.remove("wild");
      cell.classList.remove("scatter");

      highlightSpecialSymbolCell(cell, currentGrid[row][reel]);
    }
  }
}

function calculateTotalWin() {
  let totalWin = 0;
  let winningLines = [];
  let hasFiveOfAKind = false;

  paylines.forEach((line, index) => {
    const lineResult = calculateLineWin(line);

    if (lineResult.win > 0) {
      totalWin += lineResult.win;

      if (lineResult.matches === 5) {
        hasFiveOfAKind = true;
      }

      winningLines.push({
        index,
        line,
        symbol: lineResult.symbol,
        matches: lineResult.matches,
        multiplier: lineResult.multiplier,
        win: lineResult.win
      });
    }
  });

  return {
    totalWin,
    winningLines,
    hasFiveOfAKind
  };
}

function calculateLineWin(line) {
  let firstSymbol = currentGrid[line[0]][0];

  if (firstSymbol === wildSymbol) {
    for (let reel = 1; reel < reels; reel++) {
      const nextSymbol = currentGrid[line[reel]][reel];

      if (nextSymbol !== wildSymbol && nextSymbol !== scatterSymbol) {
        firstSymbol = nextSymbol;
        break;
      }
    }
  }

  if (firstSymbol === wildSymbol || firstSymbol === scatterSymbol) {
    return {
      win: 0,
      symbol: firstSymbol,
      matches: 0,
      multiplier: 0
    };
  }

  let matches = 1;

  for (let reel = 1; reel < reels; reel++) {
    const row = line[reel];
    const symbol = currentGrid[row][reel];

    if (symbol === firstSymbol || symbol === wildSymbol) {
      matches++;
    } else {
      break;
    }
  }

  if (matches < 3) {
    return {
      win: 0,
      symbol: firstSymbol,
      matches,
      multiplier: 0
    };
  }

  const baseMultiplier = symbolMultipliers[firstSymbol];

  let matchMultiplier = 1;
  if (matches === 4) matchMultiplier = 2;
  if (matches === 5) matchMultiplier = 5;

  const wildCount = countWildsInLine(line, matches);

  let wildMultiplier = 1;
  if (wildCount === 1) wildMultiplier = 1.5;
  if (wildCount >= 2) wildMultiplier = 2;

  const finalMultiplier = baseMultiplier * matchMultiplier * wildMultiplier;
  const win = Math.floor(bet * finalMultiplier);

  return {
    win,
    symbol: firstSymbol,
    matches,
    multiplier: finalMultiplier
  };
}

function countWildsInLine(line, matches) {
  let wilds = 0;

  for (let reel = 0; reel < matches; reel++) {
    const row = line[reel];

    if (currentGrid[row][reel] === wildSymbol) {
      wilds++;
    }
  }

  return wilds;
}

function calculateScatterBonus(isFreeSpin) {
  if (isFreeSpin) {
    return {
      scatterCount: 0,
      freeSpinsWon: 0
    };
  }

  let scatterCount = 0;

  for (let row = 0; row < rows; row++) {
    for (let reel = 0; reel < reels; reel++) {
      if (currentGrid[row][reel] === scatterSymbol) {
        scatterCount++;
      }
    }
  }

  let freeSpinsWon = 0;

  if (scatterCount === 3) freeSpinsWon = 5;
  if (scatterCount === 4) freeSpinsWon = 7;
  if (scatterCount >= 5) freeSpinsWon = 10;

  return {
    scatterCount,
    freeSpinsWon
  };
}

function highlightWinningLines(winningLines) {
  winningLines.forEach(winLine => {
    for (let reel = 0; reel < winLine.matches; reel++) {
      const row = winLine.line[reel];
      const cell = document.getElementById(`slot-${row}-${reel}`);

      if (!cell) continue;

      cell.classList.add("win");
      cell.classList.add("line-win");
      cell.classList.add("winning");
      cell.classList.add("winning-pop");
    }
  });
}

function highlightScatters() {
  for (let row = 0; row < rows; row++) {
    for (let reel = 0; reel < reels; reel++) {
      if (currentGrid[row][reel] === scatterSymbol) {
        const cell = document.getElementById(`slot-${row}-${reel}`);
        cell.classList.add("scatter");
      }
    }
  }
}

function highlightSpecialSymbolCell(cell, symbol) {
  if (!cell) return;

  if (symbol === scatterSymbol) {
    cell.classList.add("scatter");
  }

  if (symbol === wildSymbol) {
    cell.classList.add("wild");
  }
}

function clearWinningCells() {
  document.querySelectorAll(".slot").forEach(slot => {
    slot.classList.remove("win");
    slot.classList.remove("line-win");
    slot.classList.remove("scatter");
    slot.classList.remove("wild");

    slot.classList.remove("winning");
    slot.classList.remove("winning-pop");
  });

  const winDetails = document.getElementById("winDetails");

  if (winDetails) {
    winDetails.classList.add("hidden");
    winDetails.innerHTML = "";
  }
}

function rand() {
  return symbols[Math.floor(Math.random() * symbols.length)];
}

function randRegularOrWildSymbol() {
  const pool = [...regularSymbols, wildSymbol];
  return pool[Math.floor(Math.random() * pool.length)];
}

function updateUI() {
  animateCoins(displayedCoins, coins);

  const betText = document.getElementById("betText");
  if (betText) betText.innerText = bet;

  const freeSpinsWrapper = document.getElementById("freeSpinsWrapper");

  if (freeSpinsWrapper) {
    freeSpinsWrapper.style.display = "none";
  }

  const betSelect = document.getElementById("betSelect");

  if (betSelect) {
    betSelect.disabled = freeSpins > 0 || isSpinning;
    betSelect.value = bet;
  }

  const autoSpinStatus = document.getElementById("autoSpinStatus");
  const autoSpinCount = document.getElementById("autoSpinCount");

  if (autoSpinStatus && autoSpinCount) {
  autoSpinStatus.classList.remove("hidden");
  autoSpinCount.innerText = autoSpinRunning
    ? (autoSpinInfinite ? "∞" : autoSpinsRemaining)
    : "";
  }
}

function result(text) {
  const resultBox = document.getElementById("result");
  if (resultBox) resultBox.innerText = text;
}

async function save() {
  await fetch("/save", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      coins
    })
  });

  updateLeaderboard();
}

async function updateLeaderboard() {
  const res = await fetch("/leaderboard");
  const board = await res.json();

  const list = document.getElementById("leaderboard");
  if (!list) return;

  list.innerHTML = "";

  board.forEach((user, index) => {
    const li = document.createElement("li");
    li.classList.add("leaderboard-entry");

    if (index === 0) li.classList.add("rank-1");
    if (index === 1) li.classList.add("rank-2");
    if (index === 2) li.classList.add("rank-3");

    const medal =
      index === 0 ? "🥇" :
      index === 1 ? "🥈" :
      index === 2 ? "🥉" :
      `#${index + 1}`;

    const name = user.display_name || user.username;
    const title = user.selected_title ? `👑 ${user.selected_title}` : "";

    li.innerHTML = `
      <div class="leaderboard-left">
        <span class="leaderboard-rank">${medal}</span>

        <div>
          <div class="leaderboard-name">${name}</div>
          <div class="leaderboard-title">${title}</div>
        </div>
      </div>

      <div class="leaderboard-coins">
        ${formatNumber(user.coins)} Coins
      </div>
    `;

    list.appendChild(li);
  });
}

function playSound(sound) {
  sound.currentTime = 0;
  sound.play().catch(() => {});
}

async function showBigWin(amount) {
  if (amount <= 0) return;

  const multiplier = amount / bet;
  if (multiplier < 25) return;

  const overlay = document.getElementById("bigWinOverlay");
  const amountText = document.getElementById("bigWinAmount");
  const titleText = document.getElementById("bigWinText");

  if (!overlay || !amountText || !titleText) return;

  overlay.classList.remove("big-tier", "mega-tier", "fat-tier");

  let title = "💎 BIG WIN 💎";
  let tier = "big-tier";
  let coinBursts = 1;
  let duration = 2300;
  let countDuration = 1250;

  if (multiplier >= 100) {
    title = "💎 FAT WIN 💎";
    tier = "fat-tier";
    coinBursts = 4;
    duration = 3200;
    countDuration = 2100;

    fatWinSound.currentTime = 0;
    fatWinSound.play().catch(() => {});
  } else if (multiplier >= 50) {
    title = "🔥 MEGA WIN 🔥";
    tier = "mega-tier";
    coinBursts = 2;
    duration = 2700;
    countDuration = 1650;

    megaWinSound.currentTime = 0;
    megaWinSound.play().catch(() => {});
  } else {
    bigWinSound.currentTime = 0;
    bigWinSound.play().catch(() => {});
  }

  titleText.innerText = title;
  amountText.innerText = "+0 Coins";

  overlay.classList.add(tier);
  overlay.classList.remove("hidden");

  animateNumberText(amountText, 0, amount, countDuration, "+", " Coins");

  for (let i = 0; i < coinBursts; i++) {
    setTimeout(() => {
      createFlyingCoins();
    }, i * 350);
  }

  await new Promise(resolve => setTimeout(resolve, duration));

  overlay.classList.add("hidden");
  overlay.classList.remove("big-tier", "mega-tier", "fat-tier");
}

async function showFreeSpinsWonAnimation(amount) {
  if (!amount || amount <= 0) return;

  const overlay = document.getElementById("freeSpinsWonOverlay");
  const amountBox = document.getElementById("freeSpinsWonAmount");

  if (!overlay || !amountBox) return;

  amountBox.innerText = `+${amount}`;

  overlay.classList.remove("hidden");

  createFlyingCoins();

  await new Promise(resolve => setTimeout(resolve, 1900));

  overlay.classList.add("hidden");
}

function createFlyingCoins() {
  const container = document.getElementById("flyingCoins");
  if (!container) return;

  for (let i = 0; i < 40; i++) {
    const coin = document.createElement("div");

    coin.classList.add("coin-particle");
    coin.innerText = "🪙";

    coin.style.left = `${Math.random() * 100}%`;
    coin.style.animationDuration = `${1.2 + Math.random() * 1.2}s`;
    coin.style.fontSize = `${22 + Math.random() * 18}px`;

    container.appendChild(coin);

    setTimeout(() => {
      coin.remove();
    }, 2500);
  }
}

function showWinDetails(winningLines, scatterData) {
  const box = document.getElementById("winDetails");

  if (!box) return;

  box.innerHTML = "";
  box.classList.remove("expanded");

  if (winningLines.length === 0 && scatterData.freeSpinsWon === 0) {
    box.classList.add("hidden");
    return;
  }

  const header = document.createElement("div");
  header.classList.add("win-details-header");

  const totalLines = winningLines.length;
  const hasScatter = scatterData.freeSpinsWon > 0;

  header.innerHTML = `
    <span>📜 ${totalLines} Gewinnlinie${totalLines === 1 ? "" : "n"}${hasScatter ? " + Scatter" : ""}</span>
    <span class="win-details-toggle">Klicken zum Anzeigen</span>
  `;

  box.appendChild(header);

  const content = document.createElement("div");
  content.classList.add("win-details-content");

  winningLines.forEach(winLine => {
    const div = document.createElement("div");
    div.classList.add("win-detail-line");

    div.innerText =
      `Linie ${winLine.index + 1}: ${winLine.symbol} x${winLine.matches} ` +
      `→ ${formatNumber(winLine.win)} Coins`;

    content.appendChild(div);
  });

  if (scatterData.freeSpinsWon > 0) {
    const div = document.createElement("div");
    div.classList.add("win-detail-line");

    div.innerText =
      `Scatter: ${scatterData.scatterCount} 🎁 → ${scatterData.freeSpinsWon} Freispiele`;

    content.appendChild(div);
  }

  box.appendChild(content);

  box.onclick = () => {
    box.classList.toggle("expanded");

    const toggle = box.querySelector(".win-details-toggle");

    if (toggle) {
      toggle.innerText = box.classList.contains("expanded")
        ? "Klicken zum Einklappen"
        : "Klicken zum Anzeigen";
    }
  };

  box.classList.remove("hidden");
}

function showFreeSpinSummary() {
  const overlay = document.getElementById("freeSpinSummaryOverlay");
  const text = document.getElementById("freeSpinSummaryText");

  if (!overlay || !text) return;

  text.innerText =
    `Du hast ${formatNumber(freeSpinTotalWin)} Coins in ${freeSpinStartCount} Freispielen gewonnen!`;

  overlay.classList.remove("hidden");
}

function hideFreeSpinSummary() {
  const overlay = document.getElementById("freeSpinSummaryOverlay");

  if (overlay) overlay.classList.add("hidden");

  freeSpinStartCount = 0;
  freeSpinTotalWin = 0;
}

async function startAutoSpin(amount) {
  if (autoSpinRunning || isSpinning) return;

  autoSpinRunning = true;
  autoSpinInfinite = false;
  autoSpinsRemaining = amount;

  updateUI();
  runAutoSpin();
}

async function startInfiniteAutoSpin() {
  if (autoSpinRunning || isSpinning) return;

  autoSpinRunning = true;
  autoSpinInfinite = true;
  autoSpinsRemaining = 0;

  updateUI();
  runAutoSpin();
}

function stopAutoSpin() {
  autoSpinRunning = false;
  autoSpinInfinite = false;
  autoSpinsRemaining = 0;

  updateUI();
}

async function runAutoSpin() {
  while (autoSpinRunning) {
    if (coins < bet && freeSpins <= 0) {
      stopAutoSpin();
      break;
    }

    await spin();

    if (!autoSpinInfinite) {
      autoSpinsRemaining--;
      updateUI();

      if (autoSpinsRemaining <= 0) {
        stopAutoSpin();
        break;
      }
    }

    await new Promise(resolve =>
      setTimeout(resolve, turboSpin ? 80 : 450)
    );
  }
}

function toggleTurboSpin() {
  turboSpin = !turboSpin;

  const button = document.getElementById("turboButton");
  if (!button) return;

  button.classList.toggle("active", turboSpin);
}

function animateCoins(from, to) {
  const coinsElement = document.getElementById("coins");

  if (!coinsElement) return;

  const duration = 650;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    const currentValue = Math.floor(from + (to - from) * progress);

    coinsElement.innerText = formatNumber(currentValue);

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      coinsElement.innerText = formatNumber(to);
      displayedCoins = to;
    }
  }

  requestAnimationFrame(update);
}

async function loadJackpot() {
  const res = await fetch("/jackpot", {
    credentials: "include"
  });

  const data = await res.json();
  const newAmount = Number(data.amount || 0);

  animateJackpot(displayedJackpot, newAmount);
  displayedJackpot = newAmount;
}

function startJackpotPolling() {
  if (jackpotPollInterval) return;

  jackpotPollInterval = setInterval(async () => {
    await loadJackpot();
  }, 2500);
}

function animateJackpot(from, to) {
  const jackpotAmount = document.getElementById("jackpotAmount");

  if (!jackpotAmount) return;

  const duration = 650;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    const currentValue = Math.floor(from + (to - from) * progress);

    jackpotAmount.innerText = formatNumber(currentValue);

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      jackpotAmount.innerText = formatNumber(to);
    }
  }

  requestAnimationFrame(update);
}

async function rollJackpot(isFreeSpin) {
  const res = await fetch("/jackpot", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      bet,
      isFreeSpin
    })
  });

  const data = await res.json();

  if (data.newJackpotAmount !== undefined) {
    const newAmount = Number(data.newJackpotAmount || 0);
    animateJackpot(displayedJackpot, newAmount);
    displayedJackpot = newAmount;
  }

  return data;
}

function showJackpotOverlay(amount) {
  const overlay = document.getElementById("jackpotOverlay");
  const text = document.getElementById("jackpotWinText");

  if (!overlay || !text) return;

  text.innerText = "Du hast 0 Coins gewonnen!";

  overlay.classList.remove("hidden");

  document.body.classList.add("jackpot-shake");
  document.body.classList.add("jackpot-screen-flash");

  animateNumberText(
    text,
    0,
    amount,
    2400,
    "Du hast ",
    " Coins gewonnen!"
  );

  jackpotWinSound.currentTime = 0;
  jackpotWinSound.play().catch(() => {});

  createJackpotCoins();

  setTimeout(() => {
    createJackpotCoins();
  }, 600);

  setTimeout(() => {
    createJackpotCoins();
  }, 1200);

  setTimeout(() => {
    document.body.classList.remove("jackpot-shake");
  }, 900);

  setTimeout(() => {
    document.body.classList.remove("jackpot-screen-flash");
  }, 1200);
}

function hideJackpotOverlay() {
  const overlay = document.getElementById("jackpotOverlay");

  if (overlay) overlay.classList.add("hidden");
}

function createJackpotCoins() {
  const container = document.getElementById("flyingCoins");

  if (!container) return;

  for (let i = 0; i < 90; i++) {
    const coin = document.createElement("div");

    coin.classList.add("coin-particle");
    coin.innerText = Math.random() > 0.75 ? "💎" : "🪙";

    coin.style.left = `${Math.random() * 100}%`;
    coin.style.animationDuration = `${1.4 + Math.random() * 1.8}s`;
    coin.style.fontSize = `${26 + Math.random() * 26}px`;

    container.appendChild(coin);

    setTimeout(() => {
      coin.remove();
    }, 3400);
  }
}

async function loadLiveFeed() {
  const res = await fetch("/live-feed");
  const feed = await res.json();

  const box = document.getElementById("liveFeed");
  if (!box) return;

  const newestFirst = feed.slice(0, 6);

  newestFirst.reverse().forEach(item => {
    if (knownFeedIds.includes(item.id) && box.children.length > 0) return;

    knownFeedIds.push(item.id);

    const div = document.createElement("div");
    div.classList.add("feed-item");

    const isJackpot = item.message.toLowerCase().includes("jackpot");
const isWin = item.message.toLowerCase().includes("gewann");

const tier = item.tier || "big";

if (isJackpot) {
  div.classList.add("feed-jackpot");
} else if (isWin) {
  div.classList.add(`feed-${tier}`);
}

const tag =
  isJackpot
    ? "💰 JACKPOT"
    : tier === "fat"
      ? "💎 FAT WIN"
      : tier === "mega"
        ? "🔥 MEGA WIN"
        : "💎 BIG WIN";
    const time = item.created_at ? timeAgo(item.created_at) : "";

    div.innerHTML = `
      <div class="feed-tag">${tag}</div>
      <div class="feed-message">${item.message}</div>
      <div class="feed-time" data-timestamp="${item.created_at || ""}">
        ${time}
      </div>
    `;

    box.prepend(div);

    while (box.children.length > 6) {
      box.removeChild(box.lastElementChild);
    }
  });
}

async function addLiveFeedMessage(payload) {
  const body =
    typeof payload === "string"
      ? { message: payload, tier: "big" }
      : payload;

  await fetch("/live-feed", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  loadLiveFeed();
}

function updateFeedTimes() {
  document.querySelectorAll(".feed-time").forEach(el => {
    const timestamp = el.dataset.timestamp;

    if (!timestamp) return;

    el.innerText = timeAgo(timestamp);
  });
}

function timeAgo(dateString) {
  const date = new Date(dateString);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return `vor ${seconds}s`;
  if (seconds < 3600) return `vor ${Math.floor(seconds / 60)}min`;
  if (seconds < 86400) return `vor ${Math.floor(seconds / 3600)}h`;

  return `vor ${Math.floor(seconds / 86400)}d`;
}

async function updateStats(totalWin, freeSpinsWon, jackpotWon) {
  if (!currentStats) return;

  currentStats.spins_total += 1;

  if (totalWin > 0) {
    currentStats.wins_total += 1;
    currentStats.coins_won_total += totalWin;

    if (totalWin > currentStats.biggest_win) {
      currentStats.biggest_win = totalWin;
    }
  }

  if (freeSpinsWon > 0) {
    currentStats.free_spins_won += freeSpinsWon;
  }

  if (jackpotWon) {
    currentStats.jackpots_won += 1;
  }

  updateStatsUI(currentStats);

  const res = await fetch("/update-stats", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      totalWin,
      freeSpinsWon,
      jackpotWon
    })
  });

  const data = await res.json();

  if (data.unlockedAchievements) {
    await handleAchievementUnlocks(data.unlockedAchievements);
  }
}

function updateStatsUI(user) {
  setText("statsSpins", user.spins_total || 0);
  setText("statsWins", user.wins_total || 0);
  setText("statsCoinsWon", formatNumber(user.coins_won_total || 0));
  setText("statsBiggestWin", formatNumber(user.biggest_win || 0));
  setText("statsFreeSpins", user.free_spins_won || 0);
  setText("statsJackpots", user.jackpots_won || 0);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value;
}

function formatNumber(number) {
  return Number(number).toLocaleString("de-DE");
}

function updateProfileUI(user) {
  const avatarUrl =
    user.avatar_url ||
    "https://cdn.discordapp.com/embed/avatars/0.png";

  const displayName = user.display_name || user.username;

  selectedTitle = user.selected_title || null;

  const topAvatar = document.getElementById("topProfileAvatar");
  const settingsAvatar = document.getElementById("settingsAvatar");
  const discordUsernameInput = document.getElementById("discordUsernameInput");
  const displayNameInput = document.getElementById("displayNameInput");

  if (topAvatar) topAvatar.src = avatarUrl;
  if (settingsAvatar) settingsAvatar.src = avatarUrl;
  if (discordUsernameInput) discordUsernameInput.value = user.username;
  if (displayNameInput) displayNameInput.value = displayName;
}

async function saveDisplayName() {
  const input = document.getElementById("displayNameInput");

  if (!input) return;

  const displayName = input.value.trim();

  const res = await fetch("/profile/display-name", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ displayName })
  });

  if (!res.ok) {
    alert("Displayname konnte nicht gespeichert werden.");
    return;
  }

  const data = await res.json();

  currentUser = data.display_name;

  const displayNameInput = document.getElementById("displayNameInput");
  if (displayNameInput) displayNameInput.value = data.display_name;

  updateLeaderboard();
}

function toggleProfileMenu() {
  document.getElementById("profileMenu").classList.toggle("hidden");
}

function openSettingsOverlay() {
  document.getElementById("settingsOverlay").classList.remove("hidden");
  document.getElementById("profileMenu").classList.add("hidden");
}

function closeSettingsOverlay() {
  document.getElementById("settingsOverlay").classList.add("hidden");
}

function openAdminOverlay() {
  document.getElementById("adminOverlay").classList.remove("hidden");
  document.getElementById("profileMenu").classList.add("hidden");
}

function closeAdminOverlay() {
  document.getElementById("adminOverlay").classList.add("hidden");
}

async function checkAdminPanel() {
  const res = await fetch("/admin/me", {
    credentials: "include"
  });

  const menuButton = document.getElementById("adminMenuButton");

  if (!menuButton) return;

  if (res.ok) {
    menuButton.classList.remove("hidden");
  } else {
    menuButton.classList.add("hidden");
  }
}

async function adminAddCoins() {
  const username = document.getElementById("adminUsername").value.trim();
  const amount = document.getElementById("adminCoinAmount").value;

  const res = await fetch("/admin/add-coins", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ username, amount })
  });

  const data = await res.json();

  adminStatus(
    res.ok
      ? `Coins geändert. Neuer Stand: ${formatNumber(data.coins)}`
      : data.error
  );

  updateLeaderboard();
}

async function adminGiveAllCoins() {
  const amount = document.getElementById("adminGiveAllAmount").value;

  const res = await fetch("/admin/give-all-coins", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ amount })
  });

  const data = await res.json();

  adminStatus(
    res.ok
      ? `${formatNumber(data.added)} Coins an ${data.affected} Spieler gegeben.`
      : data.error
  );

  updateLeaderboard();
}

async function adminSetJackpot() {
  const amount = document.getElementById("adminJackpotAmount").value;

  const res = await fetch("/admin/set-jackpot", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ amount })
  });

  const data = await res.json();

  adminStatus(
    res.ok
      ? `Jackpot gesetzt auf ${formatNumber(data.amount)} Coins.`
      : data.error
  );

  await loadJackpot();
}

function adminStatus(text) {
  const status = document.getElementById("adminStatus");

  if (status) status.innerText = text;
}

async function loadAchievements() {
  const res = await fetch("/achievements", {
    credentials: "include"
  });

  if (!res.ok) return;

  const achievements = await res.json();

  achievementsCache = achievements;

  renderAchievements();
  renderTitleOptions();
}

function renderAchievements() {
  const list = document.getElementById("achievementsList");

  if (!list) return;

  list.innerHTML = "";

  const categories = {
    "Spins": "🎰 Spin Achievements",
    "Coins": "💰 Win Achievements",
    "Freispiele": "🎁 Freispiele Achievements",
    "Jackpot": "💎 Jackpot Achievements"
  };

  Object.entries(categories).forEach(([key, title]) => {
    const section = document.createElement("div");
    section.classList.add("achievement-category-section");

    section.innerHTML = `
      <div class="achievement-section-title">
        ${title}
      </div>
    `;

    const filtered = achievementsCache.filter(
      achievement => achievement.category === key
    );

    filtered.forEach(achievement => {
      const progressData = getAchievementProgress(achievement);

      const card = document.createElement("div");
      card.classList.add("achievement-card");

      if (achievement.rarity) {
        card.classList.add(`rarity-${achievement.rarity}`);
      }

      if (achievement.unlocked) {
        card.classList.add("unlocked");
      } else {
        card.classList.add("locked");
      }

      card.innerHTML = `
        <div class="achievement-name">
          ${achievement.name}
        </div>

        <div class="achievement-requirement">
          🎯 ${achievement.requirement}
        </div>

        <div class="achievement-progress">
          <div
            class="achievement-progress-fill"
            style="width: ${progressData.percent}%"
          ></div>
        </div>

        <div class="achievement-progress-text">
          ${formatNumber(progressData.current)} / ${formatNumber(progressData.target)}
        </div>

        <div class="achievement-reward">
          🎁 ${achievement.reward}
        </div>
      `;

      section.appendChild(card);
    });

    list.appendChild(section);
  });
}

function getAchievementProgress(achievement) {
  if (!currentStats) {
    return {
      current: 0,
      target: 1,
      percent: 0
    };
  }

  let current = 0;
  let target = 1;

  if (achievement.category === "Spins") {
    current = currentStats.spins_total || 0;

    if (achievement.id === "rookie_spinner") target = 100;
    if (achievement.id === "reel_addict") target = 500;
    if (achievement.id === "spin_machine") target = 1000;
    if (achievement.id === "neon_gambler") target = 5000;
    if (achievement.id === "eternal_spinner") target = 10000;
  }

  if (achievement.category === "Coins") {
    current = currentStats.coins_won_total || 0;

    if (achievement.id === "high_roller") target = 1000000;
    if (achievement.id === "coin_tycoon") target = 5000000;
    if (achievement.id === "fortune_hunter") target = 10000000;
    if (achievement.id === "king_of_luck") target = 25000000;
    if (achievement.id === "slot_emperor") target = 50000000;
    if (achievement.id === "house_edge") target = 75000000;
    if (achievement.id === "casino_legend") target = 100000000;
  }

  if (achievement.category === "Freispiele") {
    current = currentStats.free_spins_won || 0;

    if (achievement.id === "lucky_scatter") target = 100;
    if (achievement.id === "free_spin_fanatic") target = 250;
    if (achievement.id === "scatter_collector") target = 500;
    if (achievement.id === "wild_fortune") target = 750;
    if (achievement.id === "scatter_god") target = 1000;
  }

  if (achievement.category === "Jackpot") {
    current = currentStats.jackpots_won || 0;

    if (achievement.id === "jackpot_hunter") target = 1;
    if (achievement.id === "jackpot_addict") target = 5;
    if (achievement.id === "mega_winner") target = 10;
    if (achievement.id === "god_of_fortune") target = 25;
  }

  const cappedCurrent = Math.min(current, target);
  const percent = Math.floor((cappedCurrent / target) * 100);

  return {
    current: cappedCurrent,
    target,
    percent
  };
}

async function handleAchievementUnlocks(unlockedAchievements) {
  if (!unlockedAchievements || unlockedAchievements.length === 0) return;

  for (const achievement of unlockedAchievements) {
    showAchievementPopup(achievement);

    const cached = achievementsCache.find(
      item => item.id === achievement.id
    );

    if (cached) cached.unlocked = true;

    renderAchievements();
    renderTitleOptions();

    await new Promise(resolve =>
      setTimeout(resolve, 2600)
    );
  }
}

function showAchievementPopup(achievement) {
  const popup = document.getElementById("achievementPopup");
  const name = document.getElementById("achievementPopupName");
  const reward = document.getElementById("achievementPopupReward");

  if (!popup || !name || !reward) return;

  name.innerText = achievement.name;
  reward.innerText = `🎁 ${achievement.reward}`;

  popup.classList.remove("hidden");

  setTimeout(() => {
    popup.classList.add("hidden");
  }, 2200);
}

function renderTitleOptions() {
  const select = document.getElementById("titleSelect");

  if (!select) return;

  select.innerHTML = `<option value="">Kein Titel</option>`;

  achievementsCache
    .filter(achievement => achievement.unlocked && achievement.title)
    .forEach(achievement => {
      const option = document.createElement("option");
      option.value = achievement.title;
      option.innerText = achievement.title;

      if (achievement.title === selectedTitle) {
        option.selected = true;
      }

      select.appendChild(option);
    });
}

async function saveSelectedTitle() {
  const select = document.getElementById("titleSelect");

  if (!select) return;

  const title = select.value || null;

  const res = await fetch("/profile/title", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ title })
  });

  if (!res.ok) {
    alert("Titel konnte nicht gespeichert werden.");
    return;
  }

  const data = await res.json();
  selectedTitle = data.selected_title;

  updateLeaderboard();
}

async function openLootboxAnimated() {
  const overlay = document.getElementById("lootboxOverlay");
  const chest = document.getElementById("lootboxChest");
  const card = document.getElementById("lootboxCard");
  const shimmer = document.getElementById("lootboxCardShimmer");
  const continueText = document.getElementById("lootboxContinue");

  if (!overlay || !chest || !card || !shimmer) {
    openLootbox();
    return;
  }

  pendingLootboxResult = null;
  lootboxCanClose = false;

  overlay.classList.remove("hidden");

  chest.className = "lootbox-chest lootbox-drop-in";
  chest.innerText = "🎁";

  card.className = "lootbox-card hidden";
  shimmer.className = "lootbox-card-shimmer common";

  if (continueText) continueText.classList.add("hidden");

  await new Promise(resolve => setTimeout(resolve, 550));

  chest.classList.add("lootbox-shake");

  await new Promise(resolve => setTimeout(resolve, 850));

  pendingLootboxResult = openLootbox();

  chest.classList.remove("lootbox-shake");
  chest.classList.add("opening");

  await new Promise(resolve => setTimeout(resolve, 450));

  shimmer.className =
    `lootbox-card-shimmer ${pendingLootboxResult.rarity}`;

  card.classList.remove("hidden");
  card.classList.add("lootbox-rise");

  await new Promise(resolve => setTimeout(resolve, 650));

  chest.classList.add("hidden");
  card.classList.remove("lootbox-rise");
  card.classList.add("lootbox-card-ready");
}

function revealLootboxCard(event) {
  event.stopPropagation();

  const card = document.getElementById("lootboxCard");
  const rarity = document.getElementById("lootboxRewardRarity");
  const text = document.getElementById("lootboxRewardText");
  const overlay = document.getElementById("lootboxOverlay");

  if (!card || !rarity || !text || !overlay || !pendingLootboxResult) return;
  if (card.classList.contains("revealed")) return;

  const labels = {
    common: "🎁 COMMON",
    rare: "💙 RARE",
    epic: "💜 EPIC",
    legendary: "🌟 LEGENDARY",
    mythic: "💎 MYTHIC 💎",
    error: "FEHLER"
  };

  rarity.innerText = labels[pendingLootboxResult.rarity] || "REWARD";
  text.innerText = pendingLootboxResult.text;

  card.classList.add("revealed");
  card.classList.add(pendingLootboxResult.rarity);

  overlay.classList.remove(
    "common-bg",
    "rare-bg",
    "epic-bg",
    "legendary-bg",
    "mythic-bg"
  );

  overlay.classList.add(`${pendingLootboxResult.rarity}-bg`);

  const raritySound = lootboxSounds[pendingLootboxResult.rarity];

  if (raritySound) {
    raritySound.currentTime = 0;
    raritySound.volume = 0.35;

    setTimeout(() => {
      raritySound.play().catch(() => {});
    }, 150);
  }

  if (pendingLootboxResult.rarity === "common") {
    createLootParticles("#bdbdbd", 12);
  }

  if (pendingLootboxResult.rarity === "rare") {
    createLootParticles("#00aaff", 18);
  }

  if (pendingLootboxResult.rarity === "epic") {
    createLootParticles("#b000ff", 24);
  }

  if (pendingLootboxResult.rarity === "legendary") {
    createLootParticles("#ffd700", 34);

    document.body.classList.add("screen-shake");

    setTimeout(() => {
      document.body.classList.remove("screen-shake");
    }, 450);
  }

  if (pendingLootboxResult.rarity === "mythic") {
    document.body.classList.add("mythic-flash");
    document.body.classList.add("screen-shake-mythic");

    createLootParticles("#ff00ff", 42);
    createLootParticles("#00ffff", 42);
    createLootParticles("#ffd700", 28);

    createFlyingCoins();
    createFlyingCoins();
    createFlyingCoins();
    createFlyingCoins();
    createFlyingCoins();

    setTimeout(() => {
      document.body.classList.remove("mythic-flash");
    }, 850);

    setTimeout(() => {
      document.body.classList.remove("screen-shake-mythic");
    }, 1200);
  }

  if (pendingLootboxResult.success) {
    createFlyingCoins();
  }

  lootboxCanClose = true;

  const continueText = document.getElementById("lootboxContinue");
  if (continueText) continueText.classList.remove("hidden");
}

function createLootParticles(color = "#ff00ff", amount = 18) {
  for (let i = 0; i < amount; i++) {
    const particle = document.createElement("div");

    particle.className = "loot-particle";
    particle.style.background = color;
    particle.style.color = color;

    particle.style.left = `${50 + (Math.random() * 22 - 11)}%`;
    particle.style.top = `${50 + (Math.random() * 14 - 7)}%`;

    particle.style.setProperty(
      "--x",
      `${Math.random() * 460 - 230}px`
    );

    particle.style.setProperty(
      "--y",
      `${Math.random() * -380}px`
    );

    document.body.appendChild(particle);

    setTimeout(() => {
      particle.remove();
    }, 1400);
  }
}

document.addEventListener("click", () => {
  const overlay = document.getElementById("lootboxOverlay");

  if (!overlay || overlay.classList.contains("hidden")) return;
  if (!lootboxCanClose) return;

  overlay.classList.add("hidden");
});

function updateOnlinePlayers() {
  const playerCount = document.getElementById("onlinePlayerCount");

  if (!playerCount) return;

  playerCount.innerText = onlinePlayers;
}

async function sendPresenceHeartbeat() {
  await fetch("/presence/heartbeat", {
    method: "POST",
    credentials: "include"
  }).catch(() => {});
}

async function loadOnlinePlayerCount() {
  const res = await fetch("/presence/count", {
    credentials: "include"
  });

  const data = await res.json();

  onlinePlayers = data.count || 0;
  updateOnlinePlayers();
}

function startPresenceSystem() {
  sendPresenceHeartbeat();
  loadOnlinePlayerCount();

  setInterval(sendPresenceHeartbeat, 20000);
  setInterval(loadOnlinePlayerCount, 10000);
}

function animateNumberText(element, from, to, duration = 1600, prefix = "", suffix = "") {
  if (!element) return;

  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    const eased = 1 - Math.pow(1 - progress, 3);
    const currentValue = Math.floor(from + (to - from) * eased);

    element.innerText = `${prefix}${formatNumber(currentValue)}${suffix}`;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.innerText = `${prefix}${formatNumber(to)}${suffix}`;
    }
  }

  requestAnimationFrame(update);
}

async function loadChatMessages() {
  const box = document.getElementById("chatMessages");
  if (!box) return;

  const shouldAutoScroll =
    box.scrollTop + box.clientHeight >= box.scrollHeight - 20;

  const res = await fetch("/chat/messages", {
    credentials: "include"
  });

  const messages = await res.json();

  box.innerHTML = "";

  messages.forEach(item => {
    const div = document.createElement("div");
    div.className = "chat-message";

    const tier = detectChatTier(item.message);

    if (tier) {
      div.classList.add(`chat-${tier}`);
    }

    div.innerHTML = `
      <span class="chat-user chat-role-${item.chat_role || "player"}">
        ${escapeHtml(item.username)}:
      </span>
      <span class="chat-text">${parse7TVEmotes(parseChatEmotes(escapeHtml(item.message)))}</span>
    `;

    box.appendChild(div);
  });

  if (shouldAutoScroll) {
    box.scrollTop = box.scrollHeight;
  }
}

function detectChatTier(message) {
  const text = message.toLowerCase();

  if (text.includes("jackpot")) return "jackpot";
  if (text.includes("fat win")) return "fat";
  if (text.includes("mega win")) return "mega";
  if (text.includes("big win")) return "big";
  if (text.includes("mythic")) return "mythic";
  if (text.includes("legendary")) return "legendary";

  return null;
}

function parseChatEmotes(text) {
  return text
    .replaceAll(":pog:", "🔥")
    .replaceAll(":rip:", "💀")
    .replaceAll(":jackpot:", "💰")
    .replaceAll(":slot:", "🎰")
    .replaceAll(":loot:", "🎁")
    .replaceAll(":coin:", "🪙")
    .replaceAll(":mythic:", "💎")
    .replaceAll(":gg:", "✨");
}

async function sendChatMessage() {
  const input = document.getElementById("chatInput");
  if (!input) return;

  const message = input.value.trim();
  if (!message) return;

  input.value = "";

  await fetch("/chat/messages", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message })
  });

  loadChatMessages();
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function adminSetChatRole() {
  const username = document.getElementById("adminRoleUsername").value.trim();
  const role = document.getElementById("adminChatRole").value;

  const res = await fetch("/admin/set-chat-role", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ username, role })
  });

  const data = await res.json();

  adminStatus(
    res.ok
      ? `${data.username} hat jetzt die Rolle ${data.role}.`
      : data.error
  );

  loadChatMessages();
}

async function load7TVEmotes() {
  sevenTvEmotes = {};

  const setIds = ["global", "6353512c802a0e34bac96dd2"];

  for (const setId of setIds) {
    try {
      const res = await fetch(`https://7tv.io/v3/emote-sets/${setId}`);
      const data = await res.json();

      if (!data.emotes) continue;

      data.emotes.forEach(item => {
        if (!item.name || !item.data?.host?.url) return;

        sevenTvEmotes[item.name] =
          `https:${item.data.host.url}/2x.webp`;
      });
    } catch (error) {
      console.warn("7TV Set konnte nicht geladen werden:", setId, error);
    }
  }

  console.log("7TV Emotes geladen:", Object.keys(sevenTvEmotes).length);
}

function parse7TVEmotes(text) {
  return text
    .split(" ")
    .map(word => {
      const cleanWord = word.replace(/[.,!?;:]/g, "");
      const punctuation = word.slice(cleanWord.length);

      const emoteUrl =
        sevenTvEmotes[cleanWord] ||
        manualEmotes[cleanWord];

      if (!emoteUrl) return word;

      return `<img class="chat-emote" src="${emoteUrl}" alt="${cleanWord}" title="${cleanWord}">${punctuation}`;
    })
    .join(" ");
}

async function resolveUnknown7TVEmotes(message) {
  const words = message.split(/\s+/);

  for (const rawWord of words) {
    const cleanWord = rawWord.replace(/[.,!?;:()[\]{}"'`]/g, "");

    if (!cleanWord || cleanWord.length < 2) continue;
    if (sevenTvEmotes[cleanWord] || manualEmotes[cleanWord]) continue;
    if (!/^[a-zA-Z0-9_]{2,40}$/.test(cleanWord)) continue;

    try {
      const res = await fetch(`/emotes/7tv/search/${encodeURIComponent(cleanWord)}`);
      const data = await res.json();

      if (data.found && data.url) {
        sevenTvEmotes[data.name] = data.url;
        sevenTvEmotes[cleanWord] = data.url;
      }
    } catch {}
  }
}