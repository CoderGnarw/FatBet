require("dotenv").config();

const express = require("express");
const session = require("express-session");
const cors = require("cors");
const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;

const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(express.json());

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    sameSite: "none"
  }
}));

app.use(passport.initialize());
app.use(passport.session());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

passport.use(new DiscordStrategy({

  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.DISCORD_REDIRECT_URI,
  scope: ["identify"]

}, async (accessToken, refreshToken, profile, done) => {

  try {

    const avatarUrl =
      `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`;

    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("discord_id", profile.id)
      .single();

    await supabase
      .from("users")
      .upsert({

        discord_id: profile.id,
        username: profile.username,
        avatar_url: avatarUrl,

        display_name:
          existingUser?.display_name || profile.username,

        spins_total:
          existingUser?.spins_total || 0,

        wins_total:
          existingUser?.wins_total || 0,

        coins_won_total:
          existingUser?.coins_won_total || 0,

        biggest_win:
          existingUser?.biggest_win || 0,

        jackpots_won:
          existingUser?.jackpots_won || 0,

        free_spins_won:
          existingUser?.free_spins_won || 0,

        coins:
          existingUser?.coins || 1000

      }, {
        onConflict: "discord_id"
      });

    return done(null, profile);

  } catch (err) {

    console.error(err);
    return done(err);

  }

}));

app.get("/auth/discord",
  passport.authenticate("discord")
);

app.get("/auth/discord/callback",

  passport.authenticate("discord", {
    failureRedirect: "/"
  }),

  async (req, res) => {

    req.session.user = {
      discord_id: req.user.id,
      username: req.user.username
    };

    req.session.save(() => {
      res.redirect("/");
    });

  }
);

app.get("/logout", (req, res) => {

  req.logout(() => {

    req.session.destroy(() => {
      res.redirect("/");
    });

  });

});

app.get("/me", async (req, res) => {

  if (!req.session.user) {
    return res.json(null);
  }

  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("discord_id", req.session.user.discord_id)
    .single();

  res.json(user);

});

app.post("/save", async (req, res) => {

  if (!req.session.user) {
    return res.sendStatus(401);
  }

  const { coins } = req.body;

  await supabase
    .from("users")
    .update({ coins })
    .eq("discord_id", req.session.user.discord_id);

  res.sendStatus(200);

});

app.get("/leaderboard", async (req, res) => {

  const { data } = await supabase
    .from("users")
    .select("*")
    .order("coins", { ascending: false })
    .limit(5);

  res.json(data || []);

});

app.post("/profile/display-name", async (req, res) => {

  if (!req.session.user) {
    return res.sendStatus(401);
  }

  const displayName =
    String(req.body.displayName || "")
      .trim()
      .slice(0, 20);

  if (!displayName) {
    return res.sendStatus(400);
  }

  await supabase
    .from("users")
    .update({
      display_name: displayName
    })
    .eq("discord_id", req.session.user.discord_id);

  res.json({
    display_name: displayName
  });

});

app.get("/jackpot", async (req, res) => {

  const { data } = await supabase
    .from("jackpot")
    .select("*")
    .eq("id", 1)
    .single();

  res.json({
    amount: data?.amount || 10000
  });

});

app.post("/jackpot", async (req, res) => {

  const { bet, isFreeSpin } = req.body;

  const { data: jackpotData } = await supabase
    .from("jackpot")
    .select("*")
    .eq("id", 1)
    .single();

  let jackpotAmount = jackpotData?.amount || 10000;

  if (!isFreeSpin) {
    jackpotAmount += Math.floor(bet * 0.02);
  }

  const jackpotChance = 0.001;

  let jackpotWon = false;
  let jackpotWin = 0;

  if (Math.random() < jackpotChance) {
    jackpotWon = true;
    jackpotWin = jackpotAmount;
    jackpotAmount = 10000;
  }

  await supabase
    .from("jackpot")
    .update({
      amount: jackpotAmount
    })
    .eq("id", 1);

  res.json({
    jackpotWon,
    jackpotWin,
    newJackpotAmount: jackpotAmount
  });

});

app.get("/live-feed", async (req, res) => {

  const { data, error } = await supabase
    .from("live_feed")
    .select("*")
    .order("created_at", {
      ascending: false
    })
    .limit(10);

  if (error) {
    console.error(error);
    return res.json([]);
  }

  res.json(data);

});

app.post("/live-feed", async (req, res) => {

  if (!req.session.user) {
    return res.sendStatus(401);
  }

  const { message } = req.body;

  if (!message) {
    return res.sendStatus(400);
  }

  await supabase
    .from("live_feed")
    .insert({
      message
    });

  res.sendStatus(200);

});

app.post("/update-stats", async (req, res) => {

  if (!req.session.user) {
    return res.sendStatus(401);
  }

  const {
    totalWin,
    freeSpinsWon,
    jackpotWon
  } = req.body;

  const discordId =
    req.session.user.discord_id;

  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("discord_id", discordId)
    .single();

  if (!user) {
    return res.sendStatus(404);
  }

  const updates = {

    spins_total:
      (user.spins_total || 0) + 1

  };

  if (totalWin > 0) {

    updates.wins_total =
      (user.wins_total || 0) + 1;

    updates.coins_won_total =
      (user.coins_won_total || 0) + totalWin;

    if (totalWin > (user.biggest_win || 0)) {
      updates.biggest_win = totalWin;
    }

  }

  if (freeSpinsWon > 0) {

    updates.free_spins_won =
      (user.free_spins_won || 0) + freeSpinsWon;

  }

  if (jackpotWon) {

    updates.jackpots_won =
      (user.jackpots_won || 0) + 1;

  }

  await supabase
    .from("users")
    .update(updates)
    .eq("discord_id", discordId);

  res.sendStatus(200);

});

module.exports = app;