
import * as cheerio from "cheerio";
import { performance } from "node:perf_hooks";
import Analysis from "../models/Analysis.js";

const MAX_HTML_SIZE = 5 * 1024 * 1024;
const REQUEST_TIMEOUT = 15000;

function normalizeUrl(value = "") {
  const input = String(value).trim();

  const url = new URL(
    /^https?:\/\//i.test(input) ? input : `https://${input}`
  );

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are allowed.");
  }

  const hostname = url.hostname.toLowerCase();

  const blocked =
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname === "169.254.169.254" ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);

  if (blocked) {
    throw new Error("Local or private network URLs are not allowed.");
  }

  return url;
}

function getMeta($, selector) {
  return $(selector).first().attr("content")?.trim() || "";
}

function countWords(text = "") {
  return text.match(/[\p{L}\p{N}]+/gu) || [];
}

function extractPageData(html, finalUrl, statusCode, loadTime) {
  const $ = cheerio.load(html);

  $("script, style, noscript, template, svg").remove();

  const metaData = {
    title: $("title").first().text().trim(),
    description: getMeta($, 'meta[name="description" i]'),
    canonical: $('link[rel="canonical"]').first().attr("href") || "",
    robots: getMeta($, 'meta[name="robots" i]'),
    ogTitle: getMeta($, 'meta[property="og:title"]'),
    ogDescription: getMeta($, 'meta[property="og:description"]'),
    ogImage: getMeta($, 'meta[property="og:image"]'),
    twitterCard: getMeta($, 'meta[name="twitter:card" i]'),
    viewport: getMeta($, 'meta[name="viewport" i]'),
    charset: $("meta[charset]").first().attr("charset") || "",
  };

  const headings = {
    h1: $("h1").length,
    h2: $("h2").length,
    h3: $("h3").length,
    h4: $("h4").length,
    h5: $("h5").length,
    h6: $("h6").length,
    h1Texts: $("h1")
      .map((_, element) => $(element).text().trim())
      .get()
      .filter(Boolean),
  };

  const imageElements = $("img");
  let missingAlt = 0;

  imageElements.each((_, element) => {
    const alt = $(element).attr("alt");

    if (alt === undefined || !alt.trim()) {
      missingAlt++;
    }
  });

  const images = {
    total: imageElements.length,
    missingAlt,
    withAlt: imageElements.length - missingAlt,
  };

  const links = {
    internal: 0,
    external: 0,
    broken: 0,
    total: $("a[href]").length,
  };

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href")?.trim();

    if (
      !href ||
      href.startsWith("#") ||
      /^(mailto:|tel:|javascript:|data:)/i.test(href)
    ) {
      return;
    }

    try {
      const linkUrl = new URL(href, finalUrl);

      if (!["http:", "https:"].includes(linkUrl.protocol)) {
        return;
      }

      if (
        linkUrl.hostname.toLowerCase() ===
        finalUrl.hostname.toLowerCase()
      ) {
        links.internal++;
      } else {
        links.external++;
      }
    } catch {
      // Ignore malformed links.
    }
  });

  const selectors = [
    "main",
    '[role="main"]',
    "article",
    "#main",
    "#content",
  ];

  let bodyText = "";

  for (const selector of selectors) {
    const text = $(selector).first().text().replace(/\s+/g, " ").trim();

    if (text.length > bodyText.length) {
      bodyText = text;
    }
  }

  if (bodyText.length < 100) {
    bodyText = $("body").text().replace(/\s+/g, " ").trim();
  }

  const words = countWords(bodyText);
  const wordCount = words.length;
  const frequency = new Map();

  for (const word of words) {
    const normalized = word.toLowerCase();

    if (normalized.length < 3) continue;

    frequency.set(
      normalized,
      (frequency.get(normalized) || 0) + 1
    );
  }

  const keywords = [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({
      word,
      count,
      density: wordCount
        ? Number(((count / wordCount) * 100).toFixed(2))
        : 0,
    }));

  return {
    url: finalUrl,
    statusCode,
    metaData,
    headings,
    links,
    images,
    keywords,
    loadTime,
    pageSize: Buffer.byteLength(html, "utf8"),
    wordCount,
    bodyText: bodyText.slice(0, 10000),
  };
}

export async function scrapeUrl(analysisId) {
  try {
    console.log("Starting website scraping:", analysisId);

    const analysis = await Analysis.findById(analysisId);

    if (!analysis) {
      throw new Error(`Analysis record not found: ${analysisId}`);
    }

    const targetUrl = normalizeUrl(analysis.url);
    const startedAt = performance.now();

    // Native fetch: no Browserbase or Playwright required.
    const response = await fetch(targetUrl.href, {
      redirect: "manual",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; RankPilotSEOAnalyzer/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    // Do not automatically follow redirects to unvalidated hosts.
    if (response.status >= 300 && response.status < 400) {
      throw new Error(
        "Website redirected the request. Validate the redirect URL before retrying."
      );
    }

    if (!response.ok) {
      throw new Error(`Website returned HTTP ${response.status}.`);
    }

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.toLowerCase().includes("text/html")) {
      throw new Error("The URL did not return an HTML page.");
    }

    const declaredLength = Number(
      response.headers.get("content-length") || 0
    );

    if (declaredLength > MAX_HTML_SIZE) {
      throw new Error("HTML page exceeds the 5 MB size limit.");
    }

    // Read the response with a byte limit.
    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error("Website returned an empty response body.");
    }

    const chunks = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        totalBytes += value.byteLength;

        if (totalBytes > MAX_HTML_SIZE) {
          await reader.cancel();
          throw new Error("HTML page exceeds the 5 MB size limit.");
        }

        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    const htmlBuffer = Buffer.concat(
      chunks.map((chunk) => Buffer.from(chunk))
    );

    const html = htmlBuffer.toString("utf8");
    const loadTime = Math.round(performance.now() - startedAt);

    const data = extractPageData(
      html,
      targetUrl.href,
      response.status,
      loadTime
    );

    data.pageSize = htmlBuffer.length;

    console.log("Website scraping completed:", {
      analysisId: analysis._id,
      url: data.url,
      statusCode: data.statusCode,
      title: data.metaData.title,
      wordCount: data.wordCount,
      h1Count: data.headings.h1,
      loadTime: data.loadTime,
    });

    if (data.wordCount === 0) {
      console.warn(
        "No readable text found. The website may require JavaScript rendering."
      );
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("Scraper service error:", error.message);

    return {
      success: false,
      message: error.message || "Failed to scrape website.",
    };
  }
}
