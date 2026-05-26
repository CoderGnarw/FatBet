require("dotenv").config();

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const session = require("express-session");
const axios = require("axios");

const app = express();
app.get("/test", (req, res) => {
  res.send("Test funktioniert");
});

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false
  }
}));

const db = new sqlite3.Database("./slots.db");

// USER TABELLE
db.run(`
CREATE TABLE IF NOT EXISTS users (
  discord_id TEXT PRIMARY KEY,
  username TEXT,
  coins INTEGER
)
`);

// DISCORD LOGIN START
app.get("/auth/discord", (req, res) => {

  const redirect =
    `https://discord.com/api/oauth2/authorize` +
    `?client_id=${process.env.DISCORD_CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT_URI)}` +
    `&scope=identify`;

  res.redirect(redirect);
});

// DISCORD CALLBACK
app.get("/auth/discord/callback", async (req, res) => {

  const code = req.query.code;

  if (!code) {
    return res.send("Kein Code erhalten.");
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

    // SESSION SPEICHERN
    req.session.user = {
      discord_id: discordUser.id,
      username: discordUser.username
    };

    // USER IN DB SUCHEN
    db.get(
      "SELECT * FROM users WHERE discord_id = ?",
      [discordUser.id],

      (err, row) => {

        if (!row) {

          // USER ERSTELLEN
          db.run(
            "INSERT INTO users VALUES (?, ?, ?)",
            [discordUser.id, discordUser.username, 1000]
          );
        }

        res.redirect(process.env.FRONTEND_URL);
      }
    );

  } catch (err) {

    console.error(err.response?.data || err.message);
    res.send("Discord Login Fehler.");
  }
});

// SESSION USER
app.get("/me", (req, res) => {

  if (!req.session.user) {
    return res.json(null);
  }

  db.get(
    "SELECT * FROM users WHERE discord_id = ?",
    [req.session.user.discord_id],

    (err, row) => {

      if (!row) {
        return res.json(null);
      }

      res.json(row);
    }
  );
});

// COINS SPEICHERN
app.post("/save", (req, res) => {

  if (!req.session.user) {
    return res.sendStatus(401);
  }

  const { coins } = req.body;

  db.run(
    "UPDATE users SET coins = ? WHERE discord_id = ?",
    [coins, req.session.user.discord_id]
  );

  res.sendStatus(200);
});

// LEADERBOARD
app.get("/leaderboard", (req, res) => {

  db.all(
    "SELECT username, coins FROM users ORDER BY coins DESC LIMIT 10",

    (err, rows) => {
      res.json(rows);
    }
  );
});

// LOGOUT
app.get("/logout", (req, res) => {

  req.session.destroy(() => {
    res.redirect(process.env.FRONTEND_URL);
  });
});

app.listen(3000, () => {
  console.log("Server läuft auf http://localhost:3000");
});