const axios = require("axios");
const cheerio = require("cheerio");

/**
 * Scrape caption and hashtags from snapsave.app — same request the downloader
 * already makes, so no extra API keys needed.
 */
async function scrapeInstaInfo(igUrl) {
  try {
    const { data } = await axios.post(
      "https://snapsave.app/action.php",
      "url=" + encodeURIComponent(igUrl),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
          referer: "https://snapsave.app/",
          origin: "https://snapsave.app",
        },
        timeout: 10000,
      }
    );

    const $ = cheerio.load(data);

    // snapsave shows the caption in .photo-info or .media-title or similar
    const caption =
      $(".photo-info p").text().trim() ||
      $(".media-body p").text().trim() ||
      $('meta[property="og:description"]').attr("content") ||
      "";

    const hashtags = [...caption.matchAll(/#[\w\u0080-\uFFFF]+/g)].map(
      (m) => m[0].replace("#", "").trim()
    );

    const title =
      caption.replace(/#[\w\u0080-\uFFFF]+/g, "").trim().split("\n")[0].slice(0, 100) ||
      "Instagram Reel";

    console.log(`[scrapeInsta] Title: ${title}`);
    console.log(`[scrapeInsta] Tags: ${hashtags.join(", ") || "none"}`);

    return { title, description: caption, tags: hashtags };
  } catch (err) {
    console.warn("[scrapeInsta] Failed:", err.message);
    return { title: "Instagram Reel", description: "", tags: [] };
  }
}

module.exports = scrapeInstaInfo;
