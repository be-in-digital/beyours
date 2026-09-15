---
"@be-in-digital/admin": patch
---

An order row in the admin list now opens that order wherever it is clicked.

The row carried `cursor-pointer` and only the text inside each cell was a link,
so a click on the cell padding, on the gap after a short badge, or anywhere in
the row's blank width did nothing. The links stay — they are what make a row
reachable by keyboard, middle-clickable and openable in a new tab — and a row
handler covers the area no anchor can reach, standing aside when the click has
already landed on something that navigates by itself.
