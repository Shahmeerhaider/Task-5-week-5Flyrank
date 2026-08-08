
const fs = require("fs");
const path = require("path");

const USER_AGENT = "FlyRankInternshipA9/1.0 (+https://github.com/YOUR_GITHUB_USERNAME/flyrank-internship)";
const TIMEOUT_MS = 8000;
const DELAY_MS = 600;
const MAX_RETRIES = 1;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cachePathFor(url, cacheDir) {
  const safe = url.replace(/^https?:\/\//, "").replace(/[^a-zA-Z0-9]+/g, "_");
  return path.join(cacheDir, `${safe}.html`);
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

// stats is a shared object the caller uses to build the final run report.
async function politeFetch(url, { cacheDir, stats }) {
  const cachePath = cachePathFor(url, cacheDir);

  if (fs.existsSync(cachePath)) {
    const html = fs.readFileSync(cachePath, "utf8");
    stats.cacheHits += 1;
    console.log(`CACHE HIT ${url} (${html.length} bytes)`);
    return { ok: true, html, status: 200, fromCache: true };
  }

  let attempt = 0;
  for (;;) {
    attempt += 1;
    try {
      const res = await fetchWithTimeout(url);
      stats.pagesFetched += 1;

      if (res.status === 200) {
        const html = await res.text();
        fs.mkdirSync(cacheDir, { recursive: true });
        fs.writeFileSync(cachePath, html, "utf8");
        console.log(`FETCH ${url} -> 200 (${html.length} bytes)`);
        await sleep(DELAY_MS);
        return { ok: true, html, status: 200, fromCache: false };
      }

      // 404 and 403 are answers, not glitches. Do not retry them.
      if (res.status === 404 || res.status === 403) {
        console.log(`FETCH ${url} -> ${res.status} (not retrying)`);
        await sleep(DELAY_MS);
        return { ok: false, status: res.status, error: `HTTP ${res.status}` };
      }

      if (res.status >= 500 && attempt <= MAX_RETRIES + 1) {
        console.log(`FETCH ${url} -> ${res.status}, retrying`);
        await sleep(DELAY_MS * 2);
        continue;
      }

      await sleep(DELAY_MS);
      return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    } catch (err) {
      if (attempt <= MAX_RETRIES + 1) {
        console.log(`FETCH ${url} -> ${err.message}, retrying`);
        await sleep(DELAY_MS * 2);
        continue;
      }
      return { ok: false, status: null, error: err.message };
    }
  }
}

module.exports = { politeFetch, USER_AGENT, cachePathFor };
