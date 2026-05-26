require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieSession = require("cookie-session");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

const app = express();

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
  sameSite: "none",
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

  if (!code) {
    return res.send("Kein Code erhalten.");
  }

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

    const { data: existingUser, error: selectError } = await supabase
      .from("users")
      .select("*")
      .eq("discord_id", discordUser.id)
      .single();

    if (selectError && selectError.code !== "PGRST116") {
      console.error(selectError);
      return res.status(500).send("Datenbankfehler beim Suchen.");
    }

    if (!existingUser) {
      const { error: insertError } = await supabase
        .from("users")
        .insert({
          discord_id: discordUser.id,
          username: discordUser.username,
          coins: 1000
        });

      if (insertError) {
        console.error(insertError);
        return res.status(500).send("Datenbankfehler beim Erstellen.");
      }
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
    .select("username, coins")
    .order("coins", { ascending: false })
    .limit(10);

  if (error) {
    console.error(error);
    return res.json([]);
  }

  res.json(data);
});

app.get("/logout", (req, res) => {
  req.session = null;
  res.redirect(process.env.FRONTEND_URL);
});

module.exports = app;