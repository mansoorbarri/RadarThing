/** Heading text to an anchor id. Shared by guide headings, the contents
 * list and guide search, so their links always match. */
export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[`*_]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
