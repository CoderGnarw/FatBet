require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieSession = require("cookie-session");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.set("trust proxy", 1);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

app.use(express.json());

app.use(cookieSession({
  name: "fatbet_session",
  keys: [process.env.SESSION_SECRET],
  maxAge: 7 * 24 * 60 * 60 * 1000,
  secure: true,
  sameSite: "lax",
  httpOnly: true
}));

const ACHIEVEMENTS = [

  // SPINS

  {
    id: "rookie_spinner",
    name: "Rookie Spinner",
    category: "Spins",
    requirement: "100 Spins",
    reward: "Bronze Badge",
    rarity: "common",
    title: null
  },

  {
    id: "reel_addict",
    name: "Reel Addict",
    category: "Spins",
    requirement: "500 Spins",
    reward: "Silber Badge",
    rarity: "rare",
    title: null
  },

  {
    id: "spin_machine",
    name: "Spin Machine",
    category: "Spins",
    requirement: "1.000 Spins",
    reward: "Titel",
    rarity: "epic",
    title: "Spin Machine"
  },

  {
    id: "neon_gambler",
    name: "Neon Gambler",
    category: "Spins",
    requirement: "5.000 Spins",
    reward: "Profilrahmen",
    rarity: "legendary",
    title: "Neon Gambler"
  },

  {
    id: "eternal_spinner",
    name: "Eternal Spinner",
    category: "Spins",
    requirement: "10.000 Spins",
    reward: "Animierter Rahmen",
    rarity: "mythic",
    title: "Eternal Spinner"
  },

  // COINS

  {
    id: "high_roller",
    name: "High Roller",
    category: "Coins",
    requirement: "1 Mio. gewonnene Coins",
    reward: "Gold Titel",
    rarity: "rare",
    title: "High Roller"
  },

  {
    id: "coin_tycoon",
    name: "Coin Tycoon",
    category: "Coins",
    requirement: "5 Mio. gewonnene Coins",
    reward: "Profilfarbe",
    rarity: "epic",
    title: "Coin Tycoon"
  },

  {
    id: "fortune_hunter",
    name: "Fortune Hunter",
    category: "Coins",
    requirement: "10 Mio. gewonnene Coins",
    reward: "Neon Badge",
    rarity: "epic",
    title: "Fortune Hunter"
  },

  {
    id: "king_of_luck",
    name: "King of Luck",
    category: "Coins",
    requirement: "25 Mio. gewonnene Coins",
    reward: "Rahmen",
    rarity: "legendary",
    title: "King of Luck"
  },

  {
    id: "slot_emperor",
    name: "Slot Emperor",
    category: "Coins",
    requirement: "50 Mio. gewonnene Coins",
    reward: "Animierter Titel",
    rarity: "legendary",
    title: "Slot Emperor"
  },

  {
    id: "house_edge",
    name: "The House Edge",
    category: "Coins",
    requirement: "75 Mio. gewonnene Coins",
    reward: "Spezialeffekt",
    rarity: "mythic",
    title: "The House Edge"
  },

  {
    id: "casino_legend",
    name: "Casino Legend",
    category: "Coins",
    requirement: "100 Mio. gewonnene Coins",
    reward: "Legendary Aura",
    rarity: "mythic",
    title: "Casino Legend"
  },

  // FREISPIELE

  {
    id: "lucky_scatter",
    name: "Lucky Scatter",
    category: "Freispiele",
    requirement: "100 Freispiele",
    reward: "Badge",
    rarity: "common",
    title: null
  },

  {
    id: "free_spin_fanatic",
    name: "Free Spin Fanatic",
    category: "Freispiele",
    requirement: "250 Freispiele",
    reward: "Titel",
    rarity: "rare",
    title: "Free Spin Fanatic"
  },

  {
    id: "scatter_collector",
    name: "Scatter Collector",
    category: "Freispiele",
    requirement: "500 Freispiele",
    reward: "Rahmen",
    rarity: "epic",
    title: "Scatter Collector"
  },

  {
    id: "wild_fortune",
    name: "Wild Fortune",
    category: "Freispiele",
    requirement: "750 Freispiele",
    reward: "Spezialfarbe",
    rarity: "legendary",
    title: "Wild Fortune"
  },

  {
    id: "scatter_god",
    name: "Scatter God",
    category: "Freispiele",
    requirement: "1.000 Freispiele",
    reward: "Legendary Titel",
    rarity: "mythic",
    title: "Scatter God"
  },

  // JACKPOT

  {
    id: "jackpot_hunter",
    name: "Jackpot Hunter",
    category: "Jackpot",
    requirement: "1 Jackpot",
    reward: "Badge",
    rarity: "rare",
    title: "Jackpot Hunter"
  },

  {
    id: "jackpot_addict",
    name: "Jackpot Addict",
    category: "Jackpot",
    requirement: "5 Jackpots",
    reward: "Titel",
    rarity: "epic",
    title: "Jackpot Addict"
  },

  {
    id: "mega_winner",
    name: "Mega Winner",
    category: "Jackpot",
    requirement: "10 Jackpots",
    reward: "Animierter Rahmen",
    rarity: "legendary",
    title: "Mega Winner"
  },

  {
    id: "god_of_fortune",
    name: "God of Fortune",
    category: "Jackpot",
    requirement: "25 Jackpots",
    reward: "Mythic Titel",
    rarity: "mythic",
    title: "God of Fortune"
  }

];

app.get("/auth/discord", (req, res) => {
  const redirect =
    "https://discord.com/api/oauth2/authorize" +
    `?client_id=${process.env.DISCORD_CLIENT_ID}` +
    "&response_type=code" +
    `&redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT_URI)}` +
    "&scope=identify";

  res.redirect(redirect);
});

app.get("/auth/discord/callback", async (req, res) => {
  const code = req.query.code;

  if (!code) return res.send("Kein Discord Code erhalten.");

  try {
    const tokenResponse = await axios.post(
      "https://discord.com/api/oauth2/token",
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    const accessToken = tokenResponse.data.access_token;

    const userResponse = await axios.get(
      "https://discord.com/api/users/@me",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    const discordUser = userResponse.data;

    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("discord_id", discordUser.id)
      .single();

    const avatarUrl = getDiscordAvatarUrl(discordUser);

    if (!existingUser) {
      await supabase
        .from("users")
        .insert({
          discord_id: discordUser.id,
          username: discordUser.username,
          display_name: discordUser.username,
          avatar_url: avatarUrl,
          coins: 1000,
          spins_total: 0,
          wins_total: 0,
          coins_won_total: 0,
          biggest_win: 0,
          jackpots_won: 0,
          free_spins_won: 0
        });
    } else {
      await supabase
        .from("users")
        .update({
          username: discordUser.username,
          avatar_url: avatarUrl
        })
        .eq("discord_id", discordUser.id);
    }

    req.session.user = {
      discord_id: discordUser.id,
      username: discordUser.username
    };

    res.redirect(process.env.FRONTEND_URL);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send("Discord Login Fehler.");
  }
});

app.get("/me", async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.json(null);
  }

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("discord_id", req.session.user.discord_id)
    .single();

  if (error) {
    console.error(error);
    return res.json(null);
  }

  res.json(data);
});

app.post("/save", async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.sendStatus(401);
  }

  const { coins } = req.body;

  const { error } = await supabase
    .from("users")
    .update({ coins })
    .eq("discord_id", req.session.user.discord_id);

  if (error) {
    console.error(error);
    return res.sendStatus(500);
  }

  res.sendStatus(200);
});

app.get("/leaderboard", async (req, res) => {
  const { data, error } = await supabase
    .from("users")
    .select("display_name, username, avatar_url, selected_title, coins")
    .order("coins", { ascending: false })
    .limit(10);

  if (error) {
    console.error(error);
    return res.json([]);
  }

  res.json(data);
});

app.post("/profile/display-name", async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.sendStatus(401);
  }

  const { displayName } = req.body;

  if (!displayName || displayName.trim().length < 2) {
    return res.status(400).json({ error: "Displayname zu kurz." });
  }

  if (displayName.length > 20) {
    return res.status(400).json({ error: "Displayname zu lang." });
  }

  const cleanName = displayName.trim();

  const { error } = await supabase
    .from("users")
    .update({ display_name: cleanName })
    .eq("discord_id", req.session.user.discord_id);

  if (error) {
    console.error(error);
    return res.sendStatus(500);
  }

  res.json({ display_name: cleanName });
});

app.get("/jackpot", async (req, res) => {
  const { data, error } = await supabase
    .from("jackpot")
    .select("amount")
    .eq("id", 1)
    .single();

  if (error) {
    console.error(error);
    return res.json({ amount: 0 });
  }

  res.json({ amount: data.amount });
});

app.post("/jackpot", async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.sendStatus(401);
  }

  const { bet, isFreeSpin } = req.body;

  if (isFreeSpin) {
    return res.json({
      contribution: 0,
      jackpotWon: false,
      jackpotWin: 0
    });
  }

  const contribution = Math.max(1, Math.floor(bet * 0.02));

  const { data, error } = await supabase
    .from("jackpot")
    .select("amount")
    .eq("id", 1)
    .single();

  if (error) {
    console.error(error);
    return res.sendStatus(500);
  }

  const newAmount = data.amount + contribution;
  const jackpotChance = 0.002;
  const jackpotWon = Math.random() < jackpotChance;

  if (jackpotWon) {
    await supabase
      .from("jackpot")
      .update({ amount: 10000 })
      .eq("id", 1);

    return res.json({
      contribution,
      jackpotWon: true,
      jackpotWin: newAmount,
      newJackpotAmount: 10000
    });
  }

  await supabase
    .from("jackpot")
    .update({ amount: newAmount })
    .eq("id", 1);

  res.json({
    contribution,
    jackpotWon: false,
    jackpotWin: 0,
    newJackpotAmount: newAmount
  });
});

app.get("/live-feed", async (req, res) => {
  const { data, error } = await supabase
    .from("live_feed")
    .select("id, message, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error(error);
    return res.json([]);
  }

  res.json(data);
});

app.post("/live-feed", async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.sendStatus(401);
  }

  const { message } = req.body;

  if (!message) {
    return res.sendStatus(400);
  }

  await supabase
    .from("live_feed")
    .insert({ message });

  res.sendStatus(200);
});

app.post("/update-stats", async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.sendStatus(401);
  }

  const { totalWin, freeSpinsWon, jackpotWon } = req.body;
  const discordId = req.session.user.discord_id;

  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("discord_id", discordId)
    .single();

  if (error || !user) {
    console.error(error);
    return res.sendStatus(404);
  }

  const updates = {
    spins_total: (user.spins_total || 0) + 1
  };

  if (totalWin > 0) {
    updates.wins_total = (user.wins_total || 0) + 1;
    updates.coins_won_total = (user.coins_won_total || 0) + totalWin;

    if (totalWin > (user.biggest_win || 0)) {
      updates.biggest_win = totalWin;
    }
  }

  if (freeSpinsWon > 0) {
    updates.free_spins_won = (user.free_spins_won || 0) + freeSpinsWon;
  }

  if (jackpotWon) {
    updates.jackpots_won = (user.jackpots_won || 0) + 1;
  }

  const { data: updatedUser, error: updateError } = await supabase
    .from("users")
    .update(updates)
    .eq("discord_id", discordId)
    .select("*")
    .single();

  if (updateError) {
    console.error(updateError);
    return res.sendStatus(500);
  }

  const unlockedAchievements = await unlockAchievements(discordId, updatedUser);

  res.json({
    ok: true,
    unlockedAchievements
  });
});

app.get("/achievements", async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.sendStatus(401);
  }

  const discordId = req.session.user.discord_id;

  const { data: unlockedRows, error } = await supabase
    .from("user_achievements")
    .select("achievement_id, unlocked_at")
    .eq("discord_id", discordId);

  if (error) {
    console.error(error);
    return res.json([]);
  }

  const unlockedMap = new Map(
    unlockedRows.map(row => [row.achievement_id, row.unlocked_at])
  );

  const achievements = ACHIEVEMENTS.map(achievement => ({
    ...achievement,
    unlocked: unlockedMap.has(achievement.id),
    unlocked_at: unlockedMap.get(achievement.id) || null
  }));

  res.json(achievements);
});

app.get("/logout", (req, res) => {
  req.session = null;
  res.redirect(process.env.FRONTEND_URL);
});

async function unlockAchievements(discordId, user) {
  const unlockedNow = [];

  const checks = [
    ["rookie_spinner", user.spins_total >= 100],
    ["reel_addict", user.spins_total >= 500],
    ["spin_machine", user.spins_total >= 1000],
    ["neon_gambler", user.spins_total >= 5000],
    ["eternal_spinner", user.spins_total >= 10000],

    ["high_roller", user.coins_won_total >= 1000000],
    ["coin_tycoon", user.coins_won_total >= 5000000],
    ["fortune_hunter", user.coins_won_total >= 10000000],
    ["king_of_luck", user.coins_won_total >= 25000000],
    ["slot_emperor", user.coins_won_total >= 50000000],
    ["house_edge", user.coins_won_total >= 75000000],
    ["casino_legend", user.coins_won_total >= 100000000],

    ["lucky_scatter", user.free_spins_won >= 100],
    ["free_spin_fanatic", user.free_spins_won >= 250],
    ["scatter_collector", user.free_spins_won >= 500],
    ["wild_fortune", user.free_spins_won >= 750],
    ["scatter_god", user.free_spins_won >= 1000],

    ["jackpot_hunter", user.jackpots_won >= 1],
    ["jackpot_addict", user.jackpots_won >= 5],
    ["mega_winner", user.jackpots_won >= 10],
    ["god_of_fortune", user.jackpots_won >= 25]
  ];

  for (const [achievementId, condition] of checks) {
    if (!condition) continue;

    const { error } = await supabase
      .from("user_achievements")
      .insert({
        discord_id: discordId,
        achievement_id: achievementId
      });

    if (!error) {
      const achievement = ACHIEVEMENTS.find(item => item.id === achievementId);
      if (achievement) {
        unlockedNow.push(achievement);
      }
    }
  }

  return unlockedNow;
}

function getDiscordAvatarUrl(discordUser) {
  if (!discordUser.avatar) {
    const defaultAvatar = Number(discordUser.discriminator || 0) % 5;
    return `https://cdn.discordapp.com/embed/avatars/${defaultAvatar}.png`;
  }

  const extension = discordUser.avatar.startsWith("a_") ? "gif" : "png";

  return `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.${extension}?size=128`;
}

function isAdmin(req) {
  const adminIds = (process.env.ADMIN_DISCORD_IDS || "")
    .split(",")
    .map(id => id.trim());

  return req.session?.user?.discord_id &&
    adminIds.includes(req.session.user.discord_id);
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) {
    return res.status(403).json({
      error: "Keine Adminrechte."
    });
  }

  next();
}

app.get("/admin/me", requireAdmin, async (req, res) => {
  res.json({ isAdmin: true });
});

app.post("/admin/add-coins", requireAdmin, async (req, res) => {
  const { username, amount } = req.body;

  const addAmount = Number(amount);

  if (!username || !Number.isFinite(addAmount)) {
    return res.status(400).json({ error: "Ungültige Eingabe." });
  }

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("coins")
    .or(`username.eq.${username},display_name.eq.${username}`)
    .single();

  if (userError || !user) {
    return res.status(404).json({ error: "Spieler nicht gefunden." });
  }

  const newCoins = user.coins + addAmount;

  await supabase
    .from("users")
    .update({ coins: newCoins })
    .or(`username.eq.${username},display_name.eq.${username}`);

  res.json({
    success: true,
    username,
    coins: newCoins
  });
});

app.post("/admin/give-all-coins", requireAdmin, async (req, res) => {
  const { amount } = req.body;

  const addAmount = Number(amount);

  if (!Number.isFinite(addAmount)) {
    return res.status(400).json({ error: "Ungültiger Betrag." });
  }

  const { data: users } = await supabase
    .from("users")
    .select("discord_id, coins");

  for (const user of users) {
    await supabase
      .from("users")
      .update({ coins: user.coins + addAmount })
      .eq("discord_id", user.discord_id);
  }

  res.json({
    success: true,
    added: addAmount,
    affected: users.length
  });
});

app.post("/admin/set-jackpot", requireAdmin, async (req, res) => {
  const { amount } = req.body;

  const jackpotAmount = Number(amount);

  if (!Number.isFinite(jackpotAmount) || jackpotAmount < 0) {
    return res.status(400).json({ error: "Ungültiger Jackpot." });
  }

  await supabase
    .from("jackpot")
    .update({ amount: jackpotAmount })
    .eq("id", 1);

  res.json({
    success: true,
    amount: jackpotAmount
  });
});

app.post("/profile/title", async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.sendStatus(401);
  }

  const { title } = req.body;
  const discordId = req.session.user.discord_id;

  if (!title) {
    await supabase
      .from("users")
      .update({ selected_title: null })
      .eq("discord_id", discordId);

    return res.json({ selected_title: null });
  }

  const achievement = ACHIEVEMENTS.find(item => item.title === title);

  if (!achievement) {
    return res.status(400).json({ error: "Ungültiger Titel." });
  }

  const { data: unlocked } = await supabase
    .from("user_achievements")
    .select("*")
    .eq("discord_id", discordId)
    .eq("achievement_id", achievement.id)
    .single();

  if (!unlocked) {
    return res.status(403).json({ error: "Titel nicht freigeschaltet." });
  }

  await supabase
    .from("users")
    .update({ selected_title: title })
    .eq("discord_id", discordId);

  res.json({ selected_title: title });
});

module.exports = app;