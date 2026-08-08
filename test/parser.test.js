const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { parseCataloguePage } = require("../src/parseCatalogue");
const { parseBookPage } = require("../src/parseBook");
const { priceTextToGbp, normalizeRecord } = require("../src/normalize");
const { BookRecordSchema } = require("../src/schema");

const FIXTURES = path.join(__dirname, "..", "fixtures");
const read = (name) => fs.readFileSync(path.join(FIXTURES, name), "utf8");

test("price normalization: text price becomes a real number", () => {
  assert.equal(priceTextToGbp("\u00a351.77"), 51.77);
  assert.equal(priceTextToGbp("\u00a30.00"), 0);
});

test("relative URLs become absolute using the platform URL resolver", () => {
  const html = read("catalogue-page.html");
  const { bookLinks, nextUrl } = parseCataloguePage(html, "https://books.toscrape.com/catalogue/page-1.html");

  for (const link of bookLinks) {
    assert.match(link, /^https:\/\/books\.toscrape\.com\//);
  }
  assert.equal(nextUrl, "https://books.toscrape.com/catalogue/page-2.html");
});

test("duplicate links on the same catalogue page collapse to one URL", () => {
  const html = read("catalogue-page.html");
  const { bookLinks } = parseCataloguePage(html, "https://books.toscrape.com/catalogue/page-1.html");

  const unique = new Set(bookLinks);
  // the fixture intentionally repeats the first book link twice
  assert.equal(bookLinks.length, 3);
  assert.equal(unique.size, 2);
});

test("a book page with no description stores null, never invented text", () => {
  const html = read("book-no-description.html");
  const record = parseBookPage(html, "https://books.toscrape.com/catalogue/set-me-free_988/index.html", "https://books.toscrape.com/catalogue/page-1.html");

  assert.equal(record.description, null);
  assert.equal(record.title, "Set Me Free");
  assert.equal(record.rating_text, "Five");
});

test("a malformed page with no price fails schema validation instead of crashing", () => {
  const html = read("book-malformed.html");
  const raw = parseBookPage(html, "https://books.toscrape.com/catalogue/broken_1/index.html", null);
  const normalized = normalizeRecord(raw);
  const result = BookRecordSchema.safeParse(normalized);

  assert.equal(result.success, false);
});

test("a complete book page produces a schema-valid record", () => {
  const html = read("book-full.html");
  const raw = parseBookPage(html, "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html", "https://books.toscrape.com/catalogue/page-1.html");
  const normalized = normalizeRecord(raw);
  const result = BookRecordSchema.safeParse(normalized);

  assert.equal(result.success, true);
  assert.equal(result.data.price_gbp, 51.77);
  assert.equal(result.data.rating_text, "Three");
  assert.match(result.data.description, /Light in the Attic/);
});
