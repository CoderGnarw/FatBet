require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieSession = require("cookie-session");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

const app = express();

// WICHTIG FÜR VERCEL COOKIES
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

// DISCORD LOGIN
app.get("/auth/discord", (req, res) => {

  const redirect =
    "https://discord.com/api/oauth2/authorize" +
    `?client_id=${process.env.DISCORD_CLIENT_ID}` +
    "&response_type=code" +
    `&redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT_URI)}` +
    "&scope=identify";

  res.redirect(redirect);
});

// DISCORD CALLBACK
app.get("/auth/discord/callback", async (req, res) => {

  const code = req.query.code;

  if (!code) {
    return res.send("Kein Discord Code erhalten.");
  }

  try {

    // TOKEN HOLEN
    const tokenResponse = await axios.post(
      "https://discord.com/api/oauth2/token",

      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI
      }),

      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // USERDATEN HOLEN
    const userResponse = await axios.get(
      "https://discord.com/api/users/@me",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    const discordUser = userResponse.data;

    // USER IN DB SUCHEN
    const { data: existingUser, error: selectError } = await supabase
      .from("users")
      .select("*")
      .eq("discord_id", discordUser.id)
      .single();

    if (selectError && selectError.code !== "PGRST116") {
      console.error(selectError);
      return res.status(500).send("Datenbankfehler.");
    }

    // USER ERSTELLEN FALLS NICHT EXISTIERT
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
        return res.status(500).send("Fehler beim Erstellen.");
      }
    }

    // SESSION SPEICHERN
    req.session.user = {
      discord_id: discordUser.id,
      username: discordUser.username
    };

    // REDIRECT ZUR WEBSITE
    res.redirect(process.env.FRONTEND_URL);

  } catch (err) {

    console.error(err.response?.data || err.message);

    res.status(500).send("Discord Login Fehler.");
  }
});

// SESSION USER LADEN
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

// COINS SPEICHERN
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

// LEADERBOARD
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

// LOGOUT
app.get("/logout", (req, res) => {

  req.session = null;

  res.redirect(process.env.FRONTEND_URL);
});

module.exports = app;