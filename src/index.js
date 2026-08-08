const fs = require("fs");
const path = require("path");
const { politeFetch } = require("./fetcher");
const { parseCataloguePage } = require("./parseCatalogue");
const { parseBookPage } = require("./parseBook");
const { normalizeRecord } = require("./normalize");
const { BookRecordSchema } = require("./schema");

const CACHE_DIR = path.join(__dirname, "..", "cache");
const OUTPUT_DIR = path.join(__dirname, "..", "output");
const CATALOGUE_START = "https://books.toscrape.com/catalogue/page-1.html";
const MAX_CATALOGUE_PAGES = 3;

function toCsv(records) {
  if (records.length === 0) return "";
  const headers = Object.keys(records[0]);
  const escape = (value) => {
    const str = value === null || value === undefined ? "" : String(value);
    return `"${str.replace(/"/g, '""')}"`;
  };
  
  const lines = [headers.join(",")];
  for (const record of records) {
    lines.push(headers.map((h) => escape(record[h])).join(","));
  }
  return lines.join("\n");
}

async function main() {
  const startedAt = Date.now();
  const stats = { pagesFetched: 0, cacheHits: 0, failedPages: 0 };

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Stage 2: discover catalogue pages and every unique book URL,
  // following the site's own "next" link rather than hardcoding pages.
  const bookUrlToSource = new Map();
  let pageUrl = CATALOGUE_START;
  let cataloguePages = 0;

  for (let i = 0; i < MAX_CATALOGUE_PAGES && pageUrl; i++) {
    const result = await politeFetch(pageUrl, { cacheDir: CACHE_DIR, stats });
    cataloguePages += 1;

    if (!result.ok) {
      stats.failedPages += 1;
      console.log(`catalogue page failed: ${pageUrl} (${result.error})`);
      break;
    }

    const { bookLinks, nextUrl } = parseCataloguePage(result.html, pageUrl);
    for (const link of bookLinks) {
      if (!bookUrlToSource.has(link)) {
        bookUrlToSource.set(link, pageUrl);
      }
    }
    pageUrl = nextUrl;
  }

  const uniqueUrls = [...bookUrlToSource.keys()];
  console.log(
    `catalogue_pages=${cataloguePages} discovered=${uniqueUrls.length} unique_urls=${uniqueUrls.length}`
  );

  // Stage 5 checkpoint helper: set INJECT_BROKEN_URL=1 to add one
  // deliberately fake book URL and prove the run survives it.
  if (process.env.INJECT_BROKEN_URL === "1") {
    const fakeUrl = "https://books.toscrape.com/catalogue/this-book-does-not-exist_00000/index.html";
    bookUrlToSource.set(fakeUrl, null);
    uniqueUrls.push(fakeUrl);
    console.log(`injected broken URL for testing: ${fakeUrl}`);
  }

  // Stage 3: extract the raw record for every book page. One broken
  // page is logged and skipped -- it never stops the run.
  const rawRecords = [];
  const failedUrls = [];

  for (const url of uniqueUrls) {
    const result = await politeFetch(url, { cacheDir: CACHE_DIR, stats });
    if (!result.ok) {
      stats.failedPages += 1;
      failedUrls.push({ url, reason: result.error });
      continue;
    }
    try {
      const raw = parseBookPage(result.html, url, bookUrlToSource.get(url));
      rawRecords.push(raw);
    } catch (err) {
      stats.failedPages += 1;
      failedUrls.push({ url, reason: `parse error: ${err.message}` });
    }
  }

  console.log(`detail_pages=${rawRecords.length}`);
  if (rawRecords.length > 0) {
    console.log("sample raw record:", JSON.stringify(rawRecords[0], null, 2));
  }

  // Stage 4: normalize, validate, and de-duplicate by canonical URL.
  // Running this twice must never produce more than one record per URL.
  const validRecords = [];
  const errorRecords = [];
  const seenUrls = new Set();

  for (const raw of rawRecords) {
    if (seenUrls.has(raw.product_url)) continue;
    seenUrls.add(raw.product_url);

    const normalized = normalizeRecord(raw);
    const parsed = BookRecordSchema.safeParse(normalized);

    if (parsed.success) {
      validRecords.push(parsed.data);
    } else {
      errorRecords.push({
        url: raw.product_url,
        reason: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
      });
    }
  }

  for (const failure of failedUrls) {
    errorRecords.push({ url: failure.url, reason: failure.reason });
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, "books.json"), JSON.stringify(validRecords, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, "errors.json"), JSON.stringify(errorRecords, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, "books.csv"), toCsv(validRecords));

  const report = {
    started_at: new Date(startedAt).toISOString(),
    duration_ms: Date.now() - startedAt,
    catalogue_pages: cataloguePages,
    discovered_urls: uniqueUrls.length,
    pages_fetched: stats.pagesFetched,
    cache_hits: stats.cacheHits,
    valid_records: validRecords.length,
    invalid_records: errorRecords.length,
    failed_pages: stats.failedPages,
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, "run-report.json"), JSON.stringify(report, null, 2));

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error("Run failed:", err);
  process.exit(1);
});
