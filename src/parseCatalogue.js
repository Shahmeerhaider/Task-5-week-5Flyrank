// Reads one catalogue listing page: every book link, turned into an
// absolute URL with the platform's own URL resolver (never string
// concatenation), plus the "next page" link if one exists.

const cheerio = require("cheerio");

function parseCataloguePage(html, pageUrl) {
  const $ = cheerio.load(html);
  const bookLinks = [];

  $("article.product_pod h3 a").each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      bookLinks.push(new URL(href, pageUrl).toString());
    }
  });

  const nextHref = $("li.next a").attr("href");
  const nextUrl = nextHref ? new URL(nextHref, pageUrl).toString() : null;

  return { bookLinks, nextUrl };
}

module.exports = { parseCataloguePage };
