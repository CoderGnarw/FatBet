function openLootbox() {
  const cost = 100;

  if (coins < cost) {
    return {
      success: false,
      rarity: "error",
      text: "Nicht genug Coins!"
    };
  }

  coins -= cost;

  const roll = Math.random();

  let reward = 0;
  let rarity = "common";

  if (roll < 0.60) {
    reward = 250;
    rarity = "common";
  } else if (roll < 0.85) {
    reward = 500;
    rarity = "rare";
  } else if (roll < 0.96) {
    reward = 1500;
    rarity = "epic";
  } else if (roll < 0.995) {
    reward = 5000;
    rarity = "legendary";
  } else {
    reward = 25000;
    rarity = "mythic";
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