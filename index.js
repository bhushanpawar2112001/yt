require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");

const Video = require("./models/Video");
const { postNextVideo, getOAuthClient, TOKENS_FILE } = require("./uploader");

const app = express();
app.use(express.json());
app.use(express.static("public"));

// ─── DB ──────────────────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err.message));

// ─── YouTube Auth ─────────────────────────────────────────────────────────────
app.get("/auth/youtube", (req, res) => {
  const client = getOAuthClient();
  const url = client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/youtube.upload"],
  });
  res.redirect(url);
});

app.get("/auth/youtube/callback", async (req, res) => {
  try {
    const client = getOAuthClient();
    const { tokens } = await client.getToken(req.query.code);
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens));
    res.send(`
      <html><body style="font-family:sans-serif;background:#0f0f0f;color:#4caf50;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
        <div style="text-align:center">
          <h2>✓ YouTube connected!</h2>
          <p style="color:#aaa;margin-top:8px"><a href="/" style="color:#aaa">← Back to app</a></p>
        </div>
      </body></html>
    `);
  } catch (err) {
    res.status(500).send("Auth failed: " + err.message);
  }
});

// ─── Queue API ────────────────────────────────────────────────────────────────

// POST /queue — add URLs (bulk, deduped)
app.post("/queue", async (req, res) => {
  const { urls } = req.body;
  if (!Array.isArray(urls) || !urls.length)
    return res.status(400).json({ error: "urls array is required" });

  // Validate all are Instagram/Facebook URLs
  const valid = urls.filter((u) =>
    /(https?:\/\/(web\.|www\.|m\.)?(facebook|fb)\.(com|watch)\S+)?$/.test(u) ||
    /(https|http):\/\/www\.instagram\.com\/(p|reel|tv|stories)/i.test(u)
  );

  if (!valid.length)
    return res.status(400).json({ error: "No valid Instagram URLs found" });

  let added = 0;
  let skipped = 0;

  for (const igUrl of valid) {
    try {
      await Video.create({ igUrl });
      added++;
    } catch (err) {
      if (err.code === 11000) skipped++; // duplicate
      else throw err;
    }
  }

  res.json({ added, skipped });
});

// GET /queue — list all videos
app.get("/queue", async (req, res) => {
  const videos = await Video.find().sort({ addedAt: -1 }).lean();
  res.json(videos);
});

// ─── Daily Scheduler: post one video per day at 10:00 AM ─────────────────────
cron.schedule("0 10 * * *", async () => {
  console.log("[cron] Running daily post...");
  await postNextVideo();
});

// ─── Manual trigger (for testing) ────────────────────────────────────────────
app.post("/trigger", async (req, res) => {
  try {
    await postNextVideo();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  if (!fs.existsSync(TOKENS_FILE)) {
    console.log(`⚠️  YouTube not authenticated → visit http://localhost:${PORT}/auth/youtube`);
  }
});
