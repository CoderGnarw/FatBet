const symbols = ["🍒", "🍋", "🔔", "⭐", "💎"];

const symbolMultipliers = {
  "🍒": 5,
  "🍋": 8,
  "🔔": 10,
  "⭐": 15,
  "💎": 25
};

// 5 Walzen x 3 Reihen
const rows = 3;
const reels = 5;

let coins = 1000;
let currentUser = "";
let bet = 50;

let currentGrid = [];

/*
  Gewinnlinien für 5 Walzen x 3 Reihen.

  Jede Linie hat 5 Zahlen.
  Jede Zahl steht für die Reihe pro Walze.

  Reihen:
  0 = oben
  1 = mitte
  2 = unten

  Beispiel:
  [1, 1, 1, 1, 1]
  bedeutet: mittlere Reihe über alle 5 Walzen.
*/
const paylines = [
  [0, 0, 0, 0, 0], // oben
  [1, 1, 1, 1, 1], // mitte
  [2, 2, 2, 2, 2], // unten

  [0, 1, 2, 1, 0], // V
  [2, 1, 0, 1, 2], // umgedrehtes V

  [0, 0, 1, 2, 2], // treppe runter
  [2, 2, 1, 0, 0], // treppe hoch

  [1, 0, 0, 0, 1], // oben bogen
  [1, 2, 2, 2, 1], // unten bogen

  [0, 1, 1, 1, 0], // flaches V oben
  [2, 1, 1, 1, 2]  // flaches V unten
];

const spinSound = new Audio("assets/sounds/spin.mp3");
const winSound = new Audio("assets/sounds/win.mp3");
const jackpotSound = new Audio("assets/sounds/jackpot.mp3");

spinSound.volume = 0.15;
winSound.volume = 0.08;
jackpotSound.volume = 0.25;

window.addEventListener("DOMContentLoaded", () => {
  createSlotGrid();
  fillGridWithRandomSymbols();
  updateUI();
});

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

async function login() {
  const name = document.getElementById("username").value.trim();

  if (!name) {
    alert("Bitte gib einen Namen ein.");
    return;
  }

  const res = await fetch("http://localhost:3000/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: name })
  });

  const data = await res.json();

  currentUser = data.username;
  coins = data.coins;

  document.getElementById("player").innerText = currentUser;
  document.getElementById("login").classList.add("hidden");
  document.getElementById("game").classList.remove("hidden");

  updateUI();
  updateLeaderboard();
}

function changeBet() {
  const selectedBet = Number(document.getElementById("betSelect").value);

  bet = selectedBet;
  updateUI();
}

async function spin() {
  clearWinningCells();

  if (coins < bet) {
    result("Nicht genug Coins!");
    return;
  }

  coins -= bet;
  updateUI();

  playSound(spinSound);

  document.querySelectorAll(".slot").forEach(slot => {
    slot.classList.add("spinning");
    slot.classList.remove("win");
  });

  animateSlots(async () => {
    generateFinalGrid();
    renderGrid();

    document.querySelectorAll(".slot").forEach(slot => {
      slot.classList.remove("spinning");
    });

    const winData = calculateTotalWin();
    const totalWin = winData.totalWin;

    if (totalWin > 0) {
      coins += totalWin;

      highlightWinningLines(winData.winningLines);

      if (winData.hasFiveOfAKind) {
        playSound(jackpotSound);
      } else {
        playSound(winSound);
      }

      const totalMultiplier = totalWin / bet;
      result(`Gewonnen: ${totalWin} Coins 🎉 | Gesamt x${totalMultiplier}`);
    } else {
      result("Leider verloren 😢");
    }

    await save();
    updateUI();
  });
}

function animateSlots(callback) {
  let spins = 22;

  const interval = setInterval(() => {
    for (let row = 0; row < rows; row++) {
      for (let reel = 0; reel < reels; reel++) {
        const delay = reel * 45;

        setTimeout(() => {
          const cell = document.getElementById(`slot-${row}-${reel}`);
          cell.innerText = rand();
        }, delay);
      }
    }

    spins--;

    if (spins <= 0) {
      clearInterval(interval);
      setTimeout(callback, 300);
    }
  }, 105);
}

function generateFinalGrid() {
  currentGrid = [];

  for (let row = 0; row < rows; row++) {
    currentGrid[row] = [];

    for (let reel = 0; reel < reels; reel++) {
      currentGrid[row][reel] = rand();
    }
  }
}

function renderGrid() {
  for (let row = 0; row < rows; row++) {
    for (let reel = 0; reel < reels; reel++) {
      document.getElementById(`slot-${row}-${reel}`).innerText = currentGrid[row][reel];
    }
  }
}

function calculateTotalWin() {
  let totalWin = 0;
  let winningLines = [];
  let hasFiveOfAKind = false;

  paylines.forEach((line, index) => {
    const result = calculateLineWin(line);

    if (result.win > 0) {
      totalWin += result.win;

      if (result.matches === 5) {
        hasFiveOfAKind = true;
      }

      winningLines.push({
        index,
        line,
        symbol: result.symbol,
        matches: result.matches,
        multiplier: result.multiplier,
        win: result.win
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

  // Gewinn erst ab 3 gleichen Symbolen von links nach rechts
  if (matches < 3) {
    return {
      win: 0,
      symbol: firstSymbol,
      matches: matches,
      multiplier: 0
    };
  }

  const baseMultiplier = symbolMultipliers[firstSymbol];

  let matchMultiplier = 1;

  if (matches === 3) {
    matchMultiplier = 1;
  } else if (matches === 4) {
    matchMultiplier = 2;
  } else if (matches === 5) {
    matchMultiplier = 5;
  }

  const finalMultiplier = baseMultiplier * matchMultiplier;
  const win = bet * finalMultiplier;

  return {
    win,
    symbol: firstSymbol,
    matches,
    multiplier: finalMultiplier
  };
}

function highlightWinningLines(winningLines) {
  winningLines.forEach(winLine => {
    for (let reel = 0; reel < winLine.matches; reel++) {
      const row = winLine.line[reel];
      const cell = document.getElementById(`slot-${row}-${reel}`);
      cell.classList.add("win");
    }
  });
}

function clearWinningCells() {
  document.querySelectorAll(".slot").forEach(slot => {
    slot.classList.remove("win");
  });
}

function rand() {
  return symbols[Math.floor(Math.random() * symbols.length)];
}

function updateUI() {
  document.getElementById("coins").innerText = coins;

  const betText = document.getElementById("betText");
  if (betText) {
    betText.innerText = bet;
  }
}

function result(text) {
  document.getElementById("result").innerText = text;
}

async function save() {
  await fetch("http://localhost:3000/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: currentUser,
      coins: coins
    })
  });

  updateLeaderboard();
}

async function updateLeaderboard() {
  const res = await fetch("http://localhost:3000/leaderboard");
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