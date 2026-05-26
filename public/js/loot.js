function openLootbox() {
  if (coins < 100) return alert("Zu wenig Coins");

  coins -= 100;

  const rewards = [0, 50, 100, 200, 500];
  const reward = rewards[Math.floor(Math.random()*rewards.length)];

  coins += reward;

  alert("Lootbox: " + reward + " Coins!");
}