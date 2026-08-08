// The shape of one finished, trustworthy record. Anything that does not
// satisfy this is set aside in errors.json instead of being stored.

const { z } = require("zod");

const RATING_WORDS = ["One", "Two", "Three", "Four", "Five"];

const BookRecordSchema = z.object({
  title: z.string().min(1),
  product_url: z.string().url(),
  price_text: z.string().min(1),
  price_gbp: z.number().positive(),
  availability_text: z.string().min(1),
  rating_text: z.enum(RATING_WORDS).nullable(),
  description: z.string().nullable(),
  source_page: z.string().url().nullable(),
  fetched_at: z.string().min(1),
});

module.exports = { BookRecordSchema, RATING_WORDS };
