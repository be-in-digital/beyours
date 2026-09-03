# ClickUp rebuild — interrupted 27 Aug 2026

**Cause:** ClickUp MCP daily quota reached (100 calls/day, free plan).
Resets ~24 h later. Nothing is lost — everything needed to resume is listed here.

## Done
- 49 of 92 tasks deleted.
  - List `Audit fonctionnalités` (901220697509): **23/23 deleted → list empty**
  - List `Technique` (901218271011): **26/54 deleted**

## Still to delete — 43 tasks

### `Technique` (901218271011) — 28 left
869eprne7 869eprmvu 869eprmpg 869eprmk8 869eprmdf 869eprmb3
869ek4xqc 869ek4vnf 869ek4vmp 869ek4vm7 869ek4vhr
869ejj0ge 869ejj083 869ejhzyd 869ejhzt1 869ejhzgf
869ejhzew 869ejhzcj 869ejhzb3 869ejhz78 869ejhx1b
869ejgy92 869ejgy8q 869ejgy8g 869ejgy8c
869ejgy83 869ejgy7y 869ejgy7w

### `Lancement` (901218271012) — 15 left
869ept6w9 869ept4de 869ept48h 869ept42e
869eprtmu 869eprteq 869eprt8m 869eprt1c 869eprru0
869eprrpb 869eprrh7 869eprrdc 869eprraa 869eprr6c 869eprr1e

## Remaining plan — spread over two days
ClickUp quota is 100 MCP calls/day; the full job needs ~162.

**Day 1 (~96 calls)**
1. Delete the 43 tasks above — 43 calls
2. Rename list `Audit fonctionnalités` → `P0 blockers` — 1 call
3. Create the 35 P0 tasks from `tasks/sales-readiness-backlog.md`, each carrying its
   GitHub issue URL from `issue-map.tsv` — 35 calls
4. Create the audit document in the space plus its content page — 2 calls

**Day 2 (~44 calls)**
1. Create the 12 `TECH-*` tasks in `Technique` — 12 calls
2. Create the 10 `LAUNCH-*` tasks in `Lancement` — 10 calls
3. Comment each of the 57 GitHub issues with its ClickUp URL — via `gh`, **off ClickUp quota**
4. Add the issue URL as a ClickUp comment on the 22 day-2 tasks — 22 calls

## Manual steps in the ClickUp UI — no MCP tool exists for these
- Rename the space `Espace de l'équipe` → **`BeYours`**
- Delete the folder `beyours` (901211338962) once the three lists are lifted to the
  space level — or keep it if that nesting level is wanted

## Target structure
```
Space "BeYours"
├── P0 blockers   35 tasks — nothing sells while these are open
├── Technique     12 tasks — P1 grouped by domain
└── Lancement     10 tasks — operator actions and product decisions
```

## Sources
- `tasks/sales-readiness-backlog.md` — full content of the 57 cards
- `tasks/battle-plan.md` — the same 57, grouped into 15 dependency-ordered batches
- `tasks/clickup-backup-2026-08-27/issue-map.tsv` — card → issue number → URL
- `tasks/clickup-backup-2026-08-27/en-rename.log` — English rewrite audit trail
- `tasks/clickup-backup-2026-08-27/DELETED-TASKS.md` — what was deleted
