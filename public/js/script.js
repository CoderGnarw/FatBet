const regularSymbols = ["🍒", "🍋", "🔔", "⭐", "💎"];
const scatterSymbol = "🎁";
const symbols = [...regularSymbols, scatterSymbol];

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
let currentUser = "";
let bet = 50;
let freeSpins = 0;
let currentGrid = [];
let isSpinning = false;

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
});

async function checkLogin() {
  const res = await fetch("/me", {
    credentials: "include"
  });

  const user = await res.json();

  if (!user) {
    document.getElementById("login").classList.remove("hidden");
    document.getElementById("game").classList.add("hidden");
    return;
  }

  currentUser = user.username;
  coins = user.coins;

  document.getElementById("player").innerText = currentUser;
  document.getElementById("login").classList.add("hidden");
  document.getElementById("game").classList.remove("hidden");

  updateUI();
  updateLeaderboard();
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
  return;
  }

  bet = Number(document.getElementById("betSelect").value);
  updateUI();
}

async function spin() {
  if (isSpinning) return;

  clearWinningCells();

  const isFreeSpin = freeSpins > 0;

  if (!isFreeSpin && coins < bet) {
    result("Nicht genug Coins!");
    return;
  }

  isSpinning = true;

  if (isFreeSpin) {
    freeSpins--;
    result(`Freispiel läuft 🎁 Noch ${freeSpins} übrig`);
  } else {
    coins -= bet;
  }

  updateUI();
  playSound(spinSound);

  generateFinalGrid(isFreeSpin);

  await animateReelsSequentially();

  renderGrid();

  const winData = calculateTotalWin();
  const scatterData = calculateScatterBonus(isFreeSpin);

  let totalWin = winData.totalWin;

  if (!isFreeSpin && scatterData.freeSpinsWon > 0) {
    freeSpins += scatterData.freeSpinsWon;
  }

  if (totalWin > 0) {
    coins += totalWin;
    highlightWinningLines(winData.winningLines);

    if (winData.hasFiveOfAKind) {
      playSound(jackpotSound);
    } else {
      playSound(winSound);
    }
  }

  highlightScatters();

  showWinDetails(winData.winningLines, scatterData);

  await save();

  isSpinning = false;
  updateUI();

  await showBigWin(totalWin);

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
}

function animateReelsSequentially() {
  return new Promise(resolve => {
    const reelIntervals = [];

    for (let reel = 0; reel < reels; reel++) {
      const interval = setInterval(() => {
        for (let row = 0; row < rows; row++) {
          const cell = document.getElementById(`slot-${row}-${reel}`);
          cell.classList.add("spinning");
          cell.innerText = rand();
        }
      }, 90);

      reelIntervals.push(interval);

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
      }, 900 + reel * 350);
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
      let symbol = isFreeSpin ? randRegularSymbol() : rand();

      if (!isFreeSpin && symbol === scatterSymbol) {
        if (scatterPlacedOnThisReel) {
          symbol = randRegularSymbol();
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
      document.getElementById(`slot-${row}-${reel}`).innerText =
        currentGrid[row][reel];
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
  const firstSymbol = currentGrid[line[0]][0];

  if (firstSymbol === scatterSymbol) {
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

    if (symbol === firstSymbol) {
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

  const finalMultiplier = baseMultiplier * matchMultiplier;
  const win = bet * finalMultiplier;

  return {
    win,
    symbol: firstSymbol,
    matches,
    multiplier: finalMultiplier
  };
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
  });
}
  const winDetails = document.getElementById("winDetails");

  if (winDetails) {
    winDetails.classList.add("hidden");
    winDetails.innerHTML = "";
}

function rand() {
  return symbols[Math.floor(Math.random() * symbols.length)];
}

function randRegularSymbol() {
  return regularSymbols[Math.floor(Math.random() * regularSymbols.length)];
}

function updateUI() {
  document.getElementById("coins").innerText = coins;

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
}

  const betSelect = document.getElementById("betSelect");

  if (betSelect) {
  betSelect.disabled = freeSpins > 0 || isSpinning;
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
    li.innerText = `${user.username}: ${user.coins} Coins`;
    list.appendChild(li);
  });
}

function playSound(sound) {
  sound.currentTime = 0;
  sound.play().catch(() => {});
}

async function showBigWin(totalWin) {

  const multiplier = totalWin / bet;

  if (multiplier < 25) {
    return;
  }

  const overlay = document.getElementById("bigWinOverlay");
  const text = document.getElementById("bigWinText");
  const amount = document.getElementById("bigWinAmount");

  if (multiplier >= 100) {
    text.innerText = "💎 FAT WIN 💎";
  }
  else if (multiplier >= 50) {
    text.innerText = "🔥 MEGA WIN 🔥";
  }
  else {
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