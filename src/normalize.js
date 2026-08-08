
function priceTextToGbp(priceText) {
  const match = String(priceText || "").match(/([\d.]+)/);
  if (!match) return null;
  return Math.round(parseFloat(match[1]) * 100) / 100;
}

function normalizeRecord(raw) {
  return {
    ...raw,
    price_gbp: priceTextToGbp(raw.price_text),
  };
}

module.exports = { priceTextToGbp, normalizeRecord };
