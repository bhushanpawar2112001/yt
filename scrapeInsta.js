const axios = require("axios");
const cheerio = require("cheerio");

/**
 * Scrape title, description, and hashtags from an Instagram post URL.
 * Uses the public oEmbed endpoint + meta tag scraping — no login needed.
 */
async function scrapeInstaInfo(igUrl) {
  try {
    // Instagram's public oEmbed (gives clean title/author)
    const oembed = await axios.get(
      `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(igUrl)}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        },
        timeout: 8000,
      }
    );

    const oembedTitle = oembed.data?.title || "";

    // Also scrape the page for og:description which contains the full caption
    const page = await axios.get(igUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
      timeout: 10000,
    });

    const $ = cheerio.load(page.data);
    const ogDesc =
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      oembedTitle ||
      "";

    // Extract hashtags from the caption
    const hashtags = [...ogDesc.matchAll(/#[\w\u0080-\uFFFF]+/g)].map(
      (m) => m[0].replace("#", "").trim()
    );

    // Clean description — remove hashtags from end for a cleaner YT description
    const description = ogDesc.trim();

    // Title: first sentence of caption or oEmbed title
    const title =
      oembedTitle ||
      ogDesc.split(/[.\n]/)[0].replace(/#[\w]+/g, "").trim().slice(0, 100) ||
      "Instagram Reel";

    return { title, description, tags: hashtags };
  } catch (err) {
    console.warn("[scrapeInsta] Could not fetch caption:", err.message);
    return { title: "Instagram Reel", description: "", tags: [] };
  }
}

module.exports = scrapeInstaInfo;
