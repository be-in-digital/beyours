---
"@be-in-digital/convex-functions": patch
---

See a media reference that is not an id.

`deleteMedia` checked every place a media is referenced by ID — a block's
`mediaId`, an article's `coverImageId` and `ogImageId`. An image dropped into an
article's body is not one of them: the editor writes `<img src="…">`, so the
reference lives as a URL in an HTML string, `usageCount` never moves, and the
library showed « Utilisations : 0 » beside the delete button for a photograph on
a published page. The bytes went with the row.

`mediaReferenceNeedles` and `textReferencesMedia` find it, matching the media's
own identifiers — id, S3 key, every URL — anywhere in a body or a block's text.
`blogCategories.imageId` is read too: the one reference in the set that IS a
plain `v.id("cmsMedia")` was the one nothing looked at.
