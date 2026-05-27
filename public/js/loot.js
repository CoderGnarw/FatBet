function openLootbox() {
  const cost = 25000;

  if (coins < cost) {
    return {
      success: false,
      rarity: "error",
      text: "Nicht genug Coins!"
    };
  }

  coins -= cost;

  const roll = Math.random();

  let rarity = "common";
  let reward = 0;

  if (roll < 0.55) {
    rarity = "common";
    reward = randomCoins(1000, 3500);
  } else if (roll < 0.80) {
    rarity = "rare";
    reward = randomCoins(5000, 12000);
  } else if (roll < 0.94) {
    rarity = "epic";
    reward = randomCoins(15000, 30000);
  } else if (roll < 0.99) {
    rarity = "legendary";
    reward = randomCoins(35000, 55000);
  } else {
    rarity = "mythic";
    reward = randomCoins(50000, 75000);
  }

  coins += reward;

  updateUI();
  save();

  return {
    success: true,
    rarity,
    reward,
    text: `+${formatNumber(reward)} Coins`
  };
}

function randomCoins(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}