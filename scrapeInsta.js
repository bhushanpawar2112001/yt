const axios = require("axios");

/**
 * Fetch Instagram post info using the public oEmbed API.
 * No login, no scraping — works from servers.
 */
async function scrapeInstaInfo(igUrl) {
  try {
    const { data } = await axios.get(
      `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(igUrl)}&maxwidth=320`,
      {
        params: {
          access_token: `${process.env.FB_APP_ID}|${process.env.FB_APP_SECRET}`,
        },
        timeout: 8000,
      }
    );

    const caption = data.title || "";
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
    // Fallback — use URL-based title, no tags
    console.warn("[scrapeInsta] oEmbed failed:", err.message);
    return { title: "Instagram Reel", description: "", tags: [] };
  }
}

module.exports = scrapeInstaInfo;
