
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
