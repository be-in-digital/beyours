---
"@be-in-digital/admin": minor
"@be-in-digital/convex-functions": major
---

Give the contact form's messages a screen to be read on

`contactMessages.create` was called by the storefront form. `list` and
`updateStatus` were exposed and permission-guarded, and called by nothing: a
customer wrote, the row landed in `contactMessages`, and the restaurant had no
way to read it. The `status` field offered `new` / `read` / `archived`, and
nothing could move a message between them.

There is a Messages screen now, in the Opérations group of the admin, behind
`customers:read`. It lists a store's messages newest first with sender, subject,
date and status, and filters over the three statuses. Opening one is what marks
it read; archiving it is a button in the dialog.

The two halves of that screen are guarded differently, and the roles show it:
`list` asks for `customers:read`, `updateStatus` for `customers:write`, and a
manager and a waiter hold the first without the second. They read the inbox and
change nothing in it, rather than failing on every click.

**Breaking: `contactMessages.list` now requires `paginationOpts`.** It used to
collect a store's whole table on every call. An inbox only grows, and until now
nothing read it, so nobody had met the cost. Any consumer wrapping `defs.list`
has to pass the argument through; both apps in this repository do.

A second query, `unreadCount`, is bounded at 99 and feeds a badge on the sidebar
entry, so a message that arrives while the owner is on another screen says so.
