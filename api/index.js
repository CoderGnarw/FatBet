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
    .select("display_name, username, avatar_url, coins")
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
    .select("*")
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

  const { error: updateError } = await supabase
    .from("users")
    .update(updates)
    .eq("discord_id", discordId);

  if (updateError) {
    console.error(updateError);
    return res.sendStatus(500);
  }

  res.sendStatus(200);
});

app.get("/logout", (req, res) => {
  req.session = null;
  res.redirect(process.env.FRONTEND_URL);
});

function getDiscordAvatarUrl(discordUser) {
  if (!discordUser.avatar) {
    const defaultAvatar = Number(discordUser.discriminator || 0) % 5;
    return `https://cdn.discordapp.com/embed/avatars/${defaultAvatar}.png`;
  }

  const extension = discordUser.avatar.startsWith("a_") ? "gif" : "png";

  return `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.${extension}?size=128`;
}

module.exports = app;