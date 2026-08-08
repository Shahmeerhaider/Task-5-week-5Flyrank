// Reads one book detail page and returns the eight raw fields, exactly
// as specified. Selectors are aimed at the product area of the page,
// not the whole document, so a second unrelated price elsewhere on the
// page can never be picked up by accident. A missing description is
// stored as null -- never invented.

const cheerio = require("cheerio");

function parseBookPage(html, url, sourcePage) {
  const $ = cheerio.load(html);
  const main = $(".product_main");

  const title = main.find("h1").text().trim();
  const priceText = main.find(".price_color").first().text().trim();
  const availabilityText = main.find(".availability").text().replace(/\s+/g, " ").trim();

  const ratingClass = main.find("p.star-rating").attr("class") || "";
  const ratingWord = ratingClass.replace("star-rating", "").trim();
  const ratingText = ratingWord || null;

  const descriptionHeading = $("#product_description");
  let description = null;
  if (descriptionHeading.length > 0) {
    const text = descriptionHeading.next("p").text().trim();
    description = text || null;
  }

  return {
    title,
    product_url: url,
    price_text: priceText,
    availability_text: availabilityText,
    rating_text: ratingText,
    description,
    source_page: sourcePage,
    fetched_at: new Date().toISOString(),
  };
}

module.exports = { parseBookPage };
