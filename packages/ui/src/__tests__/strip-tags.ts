/**
 * The rendered text of a markup string, for tests that assert on what a
 * component actually says.
 *
 * Every one of these tests used to spell it `html.replace(/<[^>]*>/g, "")`
 * inline, and that expression is not tag removal. It is tag removal once, over
 * well-formed tags only:
 *
 *   `<scr<x>ipt>`   removing the inner match splices its neighbours back
 *                   together, so one pass cannot see what it just created
 *   `<button aria`  never matches the pattern at all — there is no closing
 *                   `>` — so the expression returns the markup it was handed
 *
 * Which is why it lives here once, correct, instead of five times, wrong. The
 * loop settles the first case. The tail settles the second: once the loop is
 * done no `<` can have a `>` after it, so any `<` left opens a tag that never
 * closed and the remainder belongs to it.
 */
export function stripTags(html: string): string {
  let previous: string
  let current = html
  do {
    previous = current
    current = current.replace(/<[^>]*>/g, '')
  } while (current !== previous)

  return current.replace(/<[^>]*$/, '')
}
