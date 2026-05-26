function dailyReward() {
  const last = localStorage.getItem("daily");

  const now = Date.now();

  if (!last || now - last > 86400000) {
    coins += 200;
    localStorage.setItem("daily", now);
    alert("Daily Reward: +200 Coins!");
  }
}