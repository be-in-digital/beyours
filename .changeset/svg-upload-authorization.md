---
"@be-in-digital/cms": major
---

Stop `sanitizeSvg` handing back active SVG, and move it off the package barrel.

`sanitizeSvg` matched patterns against raw markup, and a string cannot be asked
what a parser would see. `<svg/onload="…">` has no whitespace before the
handler, `&#106;avascript:` only spells `javascript:` after entity decoding, and
`<set attributeName="href" to="javascript:…">` never writes the URI into an
attribute the pattern read. All three came back byte-for-byte unchanged, and
reported nothing removed. It now sanitizes with DOMPurify.

**Breaking, twice over:**

- `sanitizeSvg` and `SanitizeResult` no longer ship from the package root. They
  ship from `@be-in-digital/cms/sanitize`. DOMPurify needs a DOM, and the root
  barrel is imported by Convex isolate modules that have none — re-exporting it
  there made the whole backend fail to push (`Failed to analyze cms.js: Cannot
  read properties of undefined (reading 'bind')`). The subpath keeps the parser
  with the Node-side callers that use it.
- `sanitizeSvg` output is no longer byte-identical to its input for a clean
  file. DOMPurify re-serializes from the parsed tree, so `<circle/>` returns as
  `<circle></circle>`. The drawing is preserved; the bytes are not.

Adds `containsActiveContent` / `inspectSvgForActiveContent` to the root barrel:
a DOM-free, dependency-free check that answers "does this SVG carry anything
that could execute", for the Convex callers that cannot import a parser. It
refuses rather than scrubs — a scrubber that misses a case hands back a file the
caller then believes is safe, which is exactly how the old one failed.
