const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const snapsave = require("./snapsave-downloader/src/index");
const Video = require("./models/Video");

const TOKENS_FILE = path.join(__dirname, "tokens.json");

function getOAuthClient() {
  const client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI
  );
  if (fs.existsSync(TOKENS_FILE)) {
    client.setCredentials(JSON.parse(fs.readFileSync(TOKENS_FILE)));
  }
  return client;
}

// Called by the daily scheduler — picks the oldest pending video and posts it
async function postNextVideo() {
  const video = await Video.findOne({ status: "pending" }).sort({ addedAt: 1 });
  if (!video) {
    console.log("[scheduler] No pending videos.");
    return;
  }

  console.log(`[scheduler] Posting: ${video.igUrl}`);

  const tmpFile = path.join(__dirname, `tmp_${Date.now()}.mp4`);
  try {
    // 1. Get download URL
    const result = await snapsave(video.igUrl);
    if (!result.status) throw new Error(result.msg || "snapsave failed");

    const downloadUrl = result.data[0].url;

    // 2. Download video
    const response = await axios.get(downloadUrl, { responseType: "stream" });
    const writer = fs.createWriteStream(tmpFile);
    response.data.pipe(writer);
    await new Promise((res, rej) => {
      writer.on("finish", res);
      writer.on("error", rej);
    });

    // 3. Upload to YouTube
    const auth = getOAuthClient();
    if (!auth.credentials?.access_token) {
      throw new Error("YouTube not authenticated. Visit /auth/youtube");
    }

    const youtube = google.youtube({ version: "v3", auth });
    const upload = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title: "Instagram Reel",
          description: "",
          categoryId: "22",
        },
        status: { privacyStatus: "public" },
      },
      media: { body: fs.createReadStream(tmpFile) },
    });

    // 4. Mark as posted
    video.status = "posted";
    video.youtubeUrl = `https://www.youtube.com/watch?v=${upload.data.id}`;
    video.postedAt = new Date();
    await video.save();

    console.log(`[scheduler] Posted → ${video.youtubeUrl}`);
  } catch (err) {
    console.error(`[scheduler] Failed: ${err.message}`);
    video.status = "failed";
    video.error = err.message;
    await video.save();
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

module.exports = { postNextVideo, getOAuthClient, TOKENS_FILE };
