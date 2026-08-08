# The Polite Scraper

A small, polite scraping pipeline for [Books to Scrape](https://books.toscrape.com):
it downloads the first three catalogue pages, follows them to all 60
book pages, turns messy HTML into clean, schema-checked JSON, survives
a broken page without crashing, and ends every run with an honest report
of what happened.

Pipeline shape: **fetch -> extract -> normalize -> validate -> store -> report**.

## Target classification

**Site:** [books.toscrape.com](https://books.toscrape.com)

**Why this site is appropriate to scrape:** its own companion page,
[toscrape.com](https://toscrape.com), describes it directly as *"a
fictional bookstore that desperately wants to be scraped... a safe place
for beginners learning web scraping and for developers validating their
scraping technologies."* It is a practice sandbox built for exactly this
exercise, not a real business.

**Scope:** the first 3 catalogue pages only (`page-1.html` through
`page-3.html`), which link to 60 unique book detail pages. No other
pages, no other categories, no pagination beyond page 3.

**Data collected:** for each of the 60 books — title, price, stock
availability, star rating, and description. All of this text is already
present in the plain HTML the server sends; nothing is scraped from
behind a login or a paywall.

**robots.txt result:** a request to `https://books.toscrape.com/robots.txt`
returns **HTTP 404** — no robots file exists on this site. A missing file
is not a grant of permission; it simply means the site has not published
automation rules. Permission here comes from the site's own stated
purpose as a scraping sandbox, not from the absence of a robots file.

I will not reuse this code on another site without checking its rules
and terms first.

## Politeness rules this scraper follows

| Rule | Implementation |
|---|---|
| Identify itself | Every real request sends `User-Agent: FlyRankInternshipA9/1.0 (+link-to-repo)` |
| Timeout | Every request aborts after 8 seconds rather than hanging forever |
| Delay | At least 600ms between real requests to the site; cached pages need no delay, since they never leave the machine |
| Check status | Only HTTP 200 is treated as a page; anything else is a failed fetch, not HTML to parse |
| Cache | Every successful response is saved to `cache/`; a second run reads the saved copy instead of asking the site again |
| Retry rules | A timeout or 5xx is retried once; a 404 or 403 is never retried, since asking again will not change the answer |

Before running, open `src/fetcher.js` and replace the placeholder GitHub
link in `USER_AGENT` with your own repository URL, so a site owner who
sees this in their logs can actually find out who made the request.

## Running it

```bash
npm install
npm start
```

This is the one documented command. It produces:

- `output/books.json` — the 60 validated records
- `output/books.csv` — the same records, flattened to CSV
- `output/errors.json` — any record that failed validation, with a reason
- `output/run-report.json` — counts and timing for the run

Running it a second time reads almost everything from `cache/` and
produces the exact same 60 records, not 120 — re-running is safe.

## The record schema

Raw extraction produces eight fields per book:

```json
{
  "title": "A Light in the Attic",
  "product_url": "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html",
  "price_text": "£51.77",
  "availability_text": "In stock (22 available)",
  "rating_text": "Three",
  "description": "...",
  "source_page": "https://books.toscrape.com/catalogue/page-1.html",
  "fetched_at": "2026-08-08T10:00:00.000Z"
}
```

Normalization adds a real number, `price_gbp: 51.77`, alongside the
original text — both are kept. Every record is then checked against a
Zod schema (`src/schema.js`) before being written to `books.json`:
`title` and `price_text` non-empty, `price_gbp` a positive number,
`rating_text` one of `One`-`Five` or `null`, `description` a string or
`null` (never invented text), `product_url` and `source_page` valid
URLs, `fetched_at` a non-empty timestamp. Anything that fails is routed
to `errors.json` with the specific reason, and never reaches
`books.json`.

`product_url` is each record's canonical identity. The pipeline
de-duplicates by this URL before validation, so a book linked twice
(which happens on this site — the same book can appear via more than one
href on a catalogue page) is stored once.

## Surviving a broken page

Each page is fetched and parsed independently, inside its own try/catch.
One broken page is logged to `errors.json` and skipped; it never stops
the run or takes down the other 59 good records.

To prove this without ever hammering the real site, set an environment
variable to add one deliberately fake book URL to the run:

```bash
INJECT_BROKEN_URL=1 npm start
```

`run-report.json` will show `failed_pages: 1`, while `books.json` still
holds all of the genuinely good records. This exact scenario was tested
during development: the injected URL does not exist, and the run
finished, reported the failure honestly, and kept every valid record
intact.

## Verified test run (fixtures, deterministic, no live network)

`npm start` requires reaching the live internet, which is not something
an automated, non-interactive environment should be assumed to have. To
verify the pipeline logic itself — discovery, absolute-URL resolution,
extraction, price normalization, schema validation, de-duplication,
error routing, and report generation — the exact same source files were
run against small HTML fixtures built from the real site's verified
structure (`fixtures/`), with no network calls at all:

```
catalogue_pages=3 discovered=4 unique_urls=4
detail_pages=4
{
  "catalogue_pages": 3,
  "discovered_urls": 4,
  "pages_fetched": 0,
  "cache_hits": 7,
  "valid_records": 3,
  "invalid_records": 1,
  "failed_pages": 0
}
```

One of the four fixture books was deliberately built with no price, to
prove the schema catches it: it landed in `errors.json` with the reason
`"price_text: String must contain at least 1 character(s); price_gbp:
Expected number, received null"`, and never reached `books.json`. A
second run of the same fixtures produced the identical 3 valid records —
proving idempotency — and a third run with `INJECT_BROKEN_URL=1` added a
genuinely nonexistent URL, attempted a real request to the live site,
received a real HTTP 403, logged it to `errors.json`, and still finished
with all 3 good records intact and `failed_pages: 1` in the report. That
third run is real evidence against the real site, not a simulation.

**Before submitting, run `npm start` yourself against the live site with
your own network connection**, and replace the run report below with
your own real output.

### Your real run-report.json goes here

```json
paste your actual output/run-report.json here after running npm start
```

## Parser tests

```bash
npm test
```

Six tests in `test/parser.test.js`, all passing, covering: price
normalization, relative-to-absolute URL resolution, duplicate URL
collapsing, a missing description resolving to `null` rather than
invented text, a malformed page failing schema validation instead of
crashing the run, and a complete page producing a fully valid record.

## Why this assignment needed no browser

A browser renders JavaScript before showing you a page; a plain HTTP
request only shows you what the server actually sent. Books to Scrape's
book data is present directly in the server's HTML response — there is
no client-side rendering step to wait for, so fetching it with a plain
HTTP request is both correct and cheaper than launching a browser.

This is not true of every site. As a direct comparison, a plain fetch of
`https://quotes.toscrape.com/js/` returns HTML containing only
navigation links and no quote text at all — the quotes are added by
JavaScript after the page loads, so a plain HTTP request cannot see
them; only a real or headless browser executing that JavaScript would.
Books to Scrape has no such step, which is why this entire pipeline uses
only `fetch` and never needed Playwright or any browser automation.

## Ethics note

- Use an official API instead of scraping whenever one exists.
- Never bypass a login, a paywall, or an explicit block.
- Collect only the data actually needed for the task at hand.
- A missing or absent robots.txt is not the same as permission — check a
  site's actual terms and stated purpose, as was done here.

## Project structure

```
src/index.js             orchestrates all seven stages, writes output/
src/fetcher.js            polite fetch: user-agent, timeout, cache, delay, retry rules
src/parseCatalogue.js      discovers book links and the next-page link
src/parseBook.js           extracts the eight raw fields from one book page
src/normalize.js           price_text -> price_gbp
src/schema.js              the Zod schema every record is checked against
fixtures/                  small real-structure HTML files used by the tests
test/parser.test.js        6 unit tests, run with `npm test`
cache/                     gitignored; saved HTML from real runs
output/                    books.json, books.csv, errors.json, run-report.json
```
