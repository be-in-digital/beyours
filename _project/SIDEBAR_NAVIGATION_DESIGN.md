# Sidebar Navigation Design - BeYours Engine

> Brainstorming session: 2026-02-16
> Status: Validated, ready for implementation

---

## Understanding Summary

- **What**: Complete restructuring of the admin sidebar navigation, from 12 flat items to ~28 items organized in 5 groups with collapsible sub-menus
- **Why**: Reflect the full product vision from day one (modules without backend = "Coming Soon" placeholder)
- **Who**: Restaurant owners/managers managing their establishment(s)
- **Constraints**: Uses shadcn/ui Sidebar component, `collapsible="icon"` mode, mobile Sheet overlay
- **Non-goals**: No implementation of missing backends/pages now, only navigation structure

---

## Final Structure

```
5 groups · 16 main items · 12 sub-items

Principal
└── Vue d'ensemble              [LayoutDashboard]    /dashboard

Opérations
├── Commandes                   [ShoppingCart]        /orders          (internal tab: Kitchen)
├── Menu & Produits             [UtensilsCrossed]     /products
├── Clients                     [Users]               /customers       Coming Soon
└── Inventaire                  [Warehouse]           /inventory       Coming Soon

Marketing
├── Promotions                  [Tag]                 /promotions      Coming Soon
├── Gamification ▾              [Gamepad2]            COLLAPSIBLE
│   ├── Dashboard                                     /games
│   ├── Jeux                                          /games/catalog
│   ├── QR Codes                                      /games/qr-codes
│   ├── Actions                                       /games/actions
│   ├── Gagnants                                      /games/winners
│   └── Paramètres                                    /games/settings
└── Email Marketing ▾           [Mail]                COLLAPSIBLE
    ├── Dashboard                                     /email           Coming Soon
    ├── Campagnes                                     /email/campaigns Coming Soon
    ├── Modèles                                       /email/templates Coming Soon
    ├── Abonnés                                       /email/subscribers Coming Soon
    ├── Segments                                      /email/segments  Coming Soon
    └── Configuration                                 /email/config    Coming Soon

Contenu
├── Pages                       [FileText]            /content/pages   Coming Soon
├── Composants                  [LayoutGrid]          /content/components Coming Soon
├── Blog                        [PenSquare]           /content/blog    Coming Soon
└── Médiathèque                 [Image]               /content/media   Coming Soon

Organisation
├── Établissements              [Store]               /stores
├── Équipe & Rôles              [UserCog]             /team
├── Paramètres                  [Settings]            /settings        (tabs: General, Design, Languages, Payments)
└── Système & Mises à jour      [RefreshCw]           /system          Coming Soon
```

---

## Assumptions

1. Kitchen = internal tab within the Orders page (not a sidebar item)
2. Design, Languages, Payments = tabs inside the Settings page
3. CMS (Content) = essential for V1 but implemented as placeholder initially
4. Billing removed — redundant with Orders + Payments
5. Analytics removed — Dashboard already covers KPIs, detailed reports are V2
6. In collapsed mode, Gamification/Email Marketing sub-menus appear as popovers on hover
7. Menu labels are in French (product targets French-speaking market)
8. "Jeux" is a catalog page listing all available game types (Wheel, Scratch, etc.) with individual config pages
9. Gamification settings = global (cooldown, social actions); Game config = per-game (win ratio, prizes, rules)

---

## Decision Log

| # | Decision | Alternatives Considered | Rationale |
|---|----------|------------------------|-----------|
| 1 | Full vision now — implement entire nav structure with Coming Soon placeholders | Progressive phases; Adaptive menu | Restaurateur sees full product roadmap from day one, builds confidence |
| 2 | Kitchen under Orders — kitchen view is an internal tab of Orders page | Separate sidebar item; Standalone fullscreen app | Kitchen is a different view of the same orders, logically linked |
| 3 | Mixed sub-menu approach — Gamification & Email Marketing get collapsible sub-menus, others use internal tabs | All sub-menus in sidebar; All internal tabs | Large modules (6+ sub-pages) deserve direct nav visibility |
| 4 | Only Gamification + Email Marketing as collapsible — these two have 6 sub-pages each | Gamification only; Add Content too | Content has only 4 simple items, doesn't justify collapsible complexity |
| 5 | CMS essential V1 — Content section (Pages, Components, Blog, Media) is in V1 scope | V2 Coming Soon; Premium optional module | Restaurateurs must be able to modify their content from launch |
| 6 | Billing = restaurant → customers | BeYours → client billing; Combined | Restaurateur manages customer receipts, not platform subscription |
| 7 | Design, Languages, Payments under Settings — become tabs in Settings page | Design under Content; Separate Configuration group | Simplifies navigation, these are rarely-modified settings |
| 8 | Icon collapse essential — collapsed mode with popovers for sub-menus | Simplified collapse (groups only); Always expanded | Important for laptop screens and workspace optimization |
| 9 | Approach A: Classic grouped sidebar — 5 SidebarGroups with labels, items, and integrated sub-menus | Two-level rail + panel; Flat list with separators | Standard shadcn/ui pattern, well-documented, accessible, familiar |
| 10 | Remove Analytics group (Reports, Real-time) — removed from V1 | Keep as Coming Soon; Keep Reports only | Dashboard covers essential KPIs; Real-time = Kitchen; Detailed reports added to Dashboard in V2 |
| 11 | Remove Billing — redundant with Orders + Payments | Keep as Coming Soon | In restaurants, invoice = order receipt, already covered by order detail and Payments section |
| 12 | "Jeux" catalog page — replaces "Roue de la Fortune" with generic game catalog | Integrated in Dashboard; Dynamic sub-items per active game | Scales when adding new game types (scratch, quiz, etc.) |
| 13 | Gamification settings ≠ Game config — both coexist: global settings (cooldown) + per-game config (win ratio) | Merge into Games page; Merge into Actions | Clear separation of responsibilities: global vs. game-specific |

---

## Routes Summary

### Existing (functional)
- `/dashboard` — Vue d'ensemble
- `/orders` — Commandes (+ Kitchen as internal tab)
- `/products` — Menu & Produits
- `/games` — Gamification Dashboard
- `/stores` — Établissements
- `/team` — Équipe & Rôles
- `/settings` — Paramètres (to be enriched with Design/Languages/Payments tabs)

### To create (Coming Soon placeholder)
- `/customers` — Clients
- `/inventory` — Inventaire
- `/promotions` — Promotions
- `/games/catalog` — Jeux (catalogue)
- `/games/qr-codes` — QR Codes
- `/games/actions` — Actions requises
- `/games/winners` — Gagnants
- `/games/settings` — Paramètres gamification
- `/email` — Email Marketing Dashboard
- `/email/campaigns` — Campagnes
- `/email/templates` — Modèles
- `/email/subscribers` — Abonnés
- `/email/segments` — Segments
- `/email/config` — Configuration email
- `/content/pages` — Pages CMS
- `/content/components` — Composants CMS
- `/content/blog` — Blog
- `/content/media` — Médiathèque
- `/system` — Système & Mises à jour

### Removed (covered by other pages)
- ~~`/categories`~~ → merged into Products (internal tab or section)
- ~~`/kitchen`~~ → merged into Orders (internal tab)
- ~~`/payments`~~ → merged into Settings (tab)
- ~~`/languages`~~ → merged into Settings (tab)
- ~~`/design`~~ → merged into Settings (tab)
- ~~`/reports`~~ → covered by Dashboard
- ~~`/realtime`~~ → covered by Kitchen view
- ~~`/billing`~~ → covered by Orders + Payments

---

## Implementation Notes

### shadcn/ui Components Used
- `SidebarProvider`, `Sidebar` (collapsible="icon")
- `SidebarHeader`, `SidebarContent`, `SidebarFooter`, `SidebarRail`
- `SidebarGroup`, `SidebarGroupLabel`, `SidebarGroupContent`
- `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton` (with tooltip)
- `SidebarMenuSub`, `SidebarMenuSubItem`, `SidebarMenuSubButton` (for Gamification, Email Marketing)
- `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` (wrapping sub-menus)

### Coming Soon Page Pattern
```tsx
export default function ComingSoonPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <Clock className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-semibold">{title}</h2>
        <p className="text-muted-foreground">
          This feature is coming soon. Stay tuned!
        </p>
      </div>
    </div>
  )
}
```
