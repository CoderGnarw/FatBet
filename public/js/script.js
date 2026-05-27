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

spinSound.volume = 0.15;
winSound.volume = 0.08;
jackpotSound.volume = 0.25;

window.addEventListener("DOMContentLoaded", async () => {
  createSlotGrid();
  fillGridWithRandomSymbols();
  updateUI();

  await checkLogin();
  await loadJackpot();
  await loadLiveFeed();

  setInterval(loadLiveFeed, 5000);
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

    if (profileWrapper) {
      profileWrapper.classList.add("hidden");
    }

    return;
  }

  currentUser = user.display_name || user.username;
  coins = user.coins;
  displayedCoins = coins;

  document.getElementById("login").classList.add("hidden");
  document.getElementById("game").classList.remove("hidden");

  if (profileWrapper) {
    profileWrapper.classList.remove("hidden");
  }

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
}

function createSlotGrid() {
  const slotGrid = document.getElementById("slotGrid");
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
      document.getElementById(`slot-${row}-${reel}`).innerText = symbol;
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
      `${currentUser} hat den Jackpot mit ${jackpotData.jackpotWin} Coins geknackt 💰`
    );
  }

  if (isFreeSpin && totalWin > 0) {
    freeSpinTotalWin += totalWin;
  }

  if (!isFreeSpin && scatterData.freeSpinsWon > 0) {
    freeSpins += scatterData.freeSpinsWon;
    freeSpinStartCount = scatterData.freeSpinsWon;
    freeSpinTotalWin = 0;
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
    await addLiveFeedMessage(
      `${currentUser} gewann ${totalWin} Coins 🎉`
    );
  }

  await updateStats(totalWin, scatterData.freeSpinsWon, jackpotData.jackpotWon);

  highlightScatters();
  showWinDetails(winData.winningLines, scatterData);

  if (totalWin > 0 && scatterData.freeSpinsWon > 0) {
    result(`Gewonnen: ${totalWin} Coins 🎉 + ${scatterData.freeSpinsWon} Freispiele 🎁`);
  } else if (totalWin > 0) {
    const totalMultiplier = totalWin / bet;
    result(`Gewonnen: ${totalWin} Coins 🎉 | Gesamt x${totalMultiplier}`);
  } else if (scatterData.freeSpinsWon > 0) {
    result(`${scatterData.freeSpinsWon} Freispiele gewonnen 🎁`);
  } else {
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
    for (let reel = 0; reel < reels; reel++) {
      const interval = setInterval(() => {
        for (let row = 0; row < rows; row++) {
          const cell = document.getElementById(`slot-${row}-${reel}`);
          cell.classList.add("spinning");
          cell.innerText = rand();
        }
      }, turboSpin ? 45 : 125);

      setTimeout(() => {
        clearInterval(interval);

        for (let row = 0; row < rows; row++) {
          const cell = document.getElementById(`slot-${row}-${reel}`);
          cell.innerText = currentGrid[row][reel];
          cell.classList.remove("spinning");
        }

        if (reel === reels - 1) {
          setTimeout(resolve, 250);
        }
      }, turboSpin ? 450 + reel * 120 : 1250 + reel * 450);
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

      if (currentGrid[row][reel] === wildSymbol) {
        cell.classList.add("wild");
      }
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

      cell.classList.add("win");
      cell.classList.add("line-win");
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

function clearWinningCells() {
  document.querySelectorAll(".slot").forEach(slot => {
    slot.classList.remove("win");
    slot.classList.remove("line-win");
    slot.classList.remove("scatter");
    slot.classList.remove("wild");
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

function randRegularSymbol() {
  return regularSymbols[Math.floor(Math.random() * regularSymbols.length)];
}

function randRegularOrWildSymbol() {
  const pool = [...regularSymbols, wildSymbol];
  return pool[Math.floor(Math.random() * pool.length)];
}

function updateUI() {
  animateCoins(displayedCoins, coins);

  const betText = document.getElementById("betText");
  if (betText) betText.innerText = bet;

  const freeSpinsText = document.getElementById("freeSpins");
  const freeSpinsWrapper = document.getElementById("freeSpinsWrapper");

  if (freeSpinsText) {
    freeSpinsText.innerText = freeSpins;
  }

  if (freeSpinsWrapper) {
    if (freeSpins > 0) {
      freeSpinsWrapper.classList.remove("hidden");
    } else {
      freeSpinsWrapper.classList.add("hidden");
    }
  }

  const betSelect = document.getElementById("betSelect");

  if (betSelect) {
    betSelect.disabled = freeSpins > 0 || isSpinning;
    betSelect.value = bet;
  }

  const autoSpinStatus = document.getElementById("autoSpinStatus");
  const autoSpinCount = document.getElementById("autoSpinCount");

  if (autoSpinStatus && autoSpinCount) {
    if (autoSpinRunning) {
      autoSpinStatus.classList.remove("hidden");
      autoSpinCount.innerText = autoSpinInfinite ? "∞" : autoSpinsRemaining;
    } else {
      autoSpinStatus.classList.add("hidden");
      autoSpinCount.innerText = "0";
    }
  }
}

function result(text) {
  document.getElementById("result").innerText = text;
}

async function save() {
  await fetch("/save", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      coins: coins
    })
  });

  updateLeaderboard();
}

async function updateLeaderboard() {
  const res = await fetch("/leaderboard");
  const board = await res.json();

  const list = document.getElementById("leaderboard");
  list.innerHTML = "";

  board.forEach(user => {
    const li = document.createElement("li");
    const name = user.display_name || user.username;

    li.innerText = `${name}: ${user.coins} Coins`;
    list.appendChild(li);
  });
}

function playSound(sound) {
  sound.currentTime = 0;
  sound.play().catch(() => {});
}

async function showBigWin(totalWin) {
  const multiplier = totalWin / bet;

  if (multiplier < 25) return;

  const overlay = document.getElementById("bigWinOverlay");
  const text = document.getElementById("bigWinText");
  const amount = document.getElementById("bigWinAmount");

  if (!overlay || !text || !amount) return;

  if (multiplier >= 100) {
    text.innerText = "💎 FAT WIN 💎";
  } else if (multiplier >= 50) {
    text.innerText = "🔥 MEGA WIN 🔥";
  } else {
    text.innerText = "🎉 BIG WIN 🎉";
  }

  amount.innerText = `+${totalWin} Coins`;

  overlay.classList.remove("hidden");

  await new Promise(resolve => setTimeout(resolve, 2600));

  overlay.classList.add("hidden");
}

function showWinDetails(winningLines, scatterData) {
  const box = document.getElementById("winDetails");

  if (!box) return;

  box.innerHTML = "";

  if (winningLines.length === 0 && scatterData.freeSpinsWon === 0) {
    box.classList.add("hidden");
    return;
  }

  winningLines.forEach(winLine => {
    const div = document.createElement("div");
    div.classList.add("win-detail-line");

    div.innerText =
      `Linie ${winLine.index + 1}: ${winLine.symbol} x${winLine.matches} ` +
      `→ ${winLine.win} Coins`;

    box.appendChild(div);
  });

  if (scatterData.freeSpinsWon > 0) {
    const div = document.createElement("div");
    div.classList.add("win-detail-line");

    div.innerText =
      `Scatter: ${scatterData.scatterCount} 🎁 → ${scatterData.freeSpinsWon} Freispiele`;

    box.appendChild(div);
  }

  box.classList.remove("hidden");
}

function showFreeSpinSummary() {
  const overlay = document.getElementById("freeSpinSummaryOverlay");
  const text = document.getElementById("freeSpinSummaryText");

  if (!overlay || !text) return;

  text.innerText =
    `Du hast ${freeSpinTotalWin} Coins in ${freeSpinStartCount} Freispielen gewonnen!`;

  overlay.classList.remove("hidden");
}

function hideFreeSpinSummary() {
  const overlay = document.getElementById("freeSpinSummaryOverlay");

  if (overlay) {
    overlay.classList.add("hidden");
  }

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

  if (turboSpin) {
    button.innerText = "⚡ Turbo AN";
    button.classList.add("active");
  } else {
    button.innerText = "⚡ Turbo AUS";
    button.classList.remove("active");
  }
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

    coinsElement.innerText = currentValue;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      coinsElement.innerText = to;
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

  const jackpotAmount = document.getElementById("jackpotAmount");

  if (jackpotAmount) {
    jackpotAmount.innerText = data.amount;
  }
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

  const jackpotAmount = document.getElementById("jackpotAmount");

  if (jackpotAmount && data.newJackpotAmount !== undefined) {
    jackpotAmount.innerText = data.newJackpotAmount;
  }

  return data;
}

function showJackpotOverlay(amount) {
  const overlay = document.getElementById("jackpotOverlay");
  const text = document.getElementById("jackpotWinText");

  if (!overlay || !text) return;

  text.innerText = `Du hast ${amount} Coins gewonnen!`;
  overlay.classList.remove("hidden");
}

function hideJackpotOverlay() {
  const overlay = document.getElementById("jackpotOverlay");

  if (overlay) {
    overlay.classList.add("hidden");
  }
}

async function loadLiveFeed() {
  const res = await fetch("/live-feed");
  const feed = await res.json();

  const box = document.getElementById("liveFeed");
  if (!box) return;

  const newestFirst = feed.slice(0, 8);

  newestFirst.reverse().forEach(item => {
    if (knownFeedIds.includes(item.id)) return;

    knownFeedIds.push(item.id);

    const div = document.createElement("div");
    div.classList.add("feed-item");
    div.innerText = item.message;

    box.prepend(div);

    while (box.children.length > 8) {
      box.removeChild(box.lastElementChild);
    }
  });
}

async function addLiveFeedMessage(message) {
  await fetch("/live-feed", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message })
  });

  loadLiveFeed();
}

async function updateStats(totalWin, freeSpinsWon, jackpotWon) {
  await fetch("/update-stats", {
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
}

function updateProfileUI(user) {
  const avatarUrl =
    user.avatar_url ||
    "https://cdn.discordapp.com/embed/avatars/0.png";

  const displayName = user.display_name || user.username;

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