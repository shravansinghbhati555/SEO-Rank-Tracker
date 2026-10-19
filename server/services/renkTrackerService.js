
function normalizeDomain(value = "") {
  try {
    const input = String(value).trim();
    const url = new URL(
      input.includes("://") ? input : `https://${input}`
    );

    return url.hostname.toLowerCase().replace(/^www\./i, "");
  } catch {
    return "";
  }
}

function isTargetDomain(resultDomain, targetDomain) {
  const result = normalizeDomain(resultDomain);
  const target = normalizeDomain(targetDomain);

  return Boolean(
    result &&
      target &&
      (result === target || result.endsWith(`.${target}`))
  );
}

function createResponse(keyword, targetDomain, overrides = {}) {
  return {
    success: overrides.success ?? true,
    ...(overrides.error ? { error: overrides.error } : {}),
    data: {
      keyword,
      targetDomain,
      position: null,
      page: null,
      title: "",
      snippet: "",
      competitors: [],
      totalResultsScanned: 0,
      scanStatus: "pending",
      ...overrides.data,
    },
  };
}

export async function ranktracker(keyword, targetDomain) {
  try {
    if (
      typeof keyword !== "string" ||
      !keyword.trim() ||
      typeof targetDomain !== "string" ||
      !targetDomain.trim()
    ) {
      return createResponse(keyword, targetDomain, {
        success: false,
        error: "Keyword and target domain are required.",
        data: { scanStatus: "error" },
      });
    }

    keyword = keyword.trim();

    const cleanTarget = normalizeDomain(targetDomain);
    const apiKey = process.env.SERPAPI_API_KEY;

    if (!cleanTarget) {
      return createResponse(keyword, targetDomain, {
        success: false,
        error: "Invalid target domain.",
        data: { scanStatus: "error" },
      });
    }

    if (!apiKey) {
      throw new Error("SERPAPI_API_KEY is missing from server .env");
    }

    const params = new URLSearchParams({
      engine: "google",
      q: keyword,
      api_key: apiKey,
      google_domain: "google.co.in",
      gl: "in",
      hl: "en",
      num: "100",
      device: "desktop",
    });

    const apiUrl =
      `https://serpapi.com/search.json?${params.toString()}`;

    console.log("\n========== SERPAPI RANK CHECK ==========");
    console.log("Keyword:", keyword);
    console.log("Target domain:", cleanTarget);

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(60000),
    });

    const json = await response.json();

    if (!response.ok || json.error) {
      const message =
        json.error || `SerpApi request failed (${response.status}).`;

      console.error("SerpApi error:", message);

      return createResponse(keyword, targetDomain, {
        success: false,
        error: message,
        data: { scanStatus: "error" },
      });
    }

    if (json.search_metadata?.status === "Error") {
      return createResponse(keyword, targetDomain, {
        success: false,
        error:
          json.search_metadata.status_message ||
          "SerpApi could not complete the search.",
        data: { scanStatus: "error" },
      });
    }

    const organicResults = Array.isArray(json.organic_results)
      ? json.organic_results
      : [];

    const results = [];
    const seenUrls = new Set();

    for (let index = 0; index < organicResults.length; index++) {
      const item = organicResults[index];

      if (!item.link || !item.title) continue;

      let parsedUrl;

      try {
        parsedUrl = new URL(item.link);
      } catch {
        continue;
      }

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        continue;
      }

      const url = parsedUrl.href;

      if (seenUrls.has(url)) continue;
      seenUrls.add(url);

      const position = Number(item.position) || index + 1;

      results.push({
        url,
        domain: parsedUrl.hostname.toLowerCase().replace(/^www\./i, ""),
        title: item.title,
        snippet: item.snippet || "",
        position,
        page: Math.ceil(position / 10),
      });
    }

    console.log("Organic results returned:", organicResults.length);
    console.log("Usable organic results:", results.length);

    const found = results.find((item) =>
      isTargetDomain(item.domain, cleanTarget)
    );

    if (found) {
      console.log("TARGET DOMAIN FOUND:", found);

      return createResponse(keyword, targetDomain, {
        success: true,
        data: {
          position: found.position,
          page: found.page,
          title: found.title,
          snippet: found.snippet,
          competitors: results
            .filter(
              (item) => !isTargetDomain(item.domain, cleanTarget)
            )
            .slice(0, 10),
          totalResultsScanned: results.length,
          scanStatus: "completed",
        },
      });
    }

    if (results.length > 0) {
      return createResponse(keyword, targetDomain, {
        success: true,
        data: {
          position: null,
          page: null,
          competitors: results.slice(0, 10),
          totalResultsScanned: results.length,
          scanStatus: "not_found",
        },
      });
    }

    return createResponse(keyword, targetDomain, {
      success: false,
      error: "No usable organic results were returned by SerpApi.",
      data: {
        totalResultsScanned: 0,
        scanStatus: "no_results",
      },
    });
  } catch (error) {
    console.error("SERP API rank tracker error:", error);

    return createResponse(keyword, targetDomain, {
      success: false,
      error: error.message || "Rank check failed.",
      data: {
        totalResultsScanned: 0,
        scanStatus: "error",
      },
    });
  }
}
