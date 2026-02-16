# BeInDigital Engine - Google Stitch Design Prompts

> Prompts optimized for [Google Stitch](https://stitch.withgoogle.com/) to generate UI designs for the full restaurant management platform.

---

## 1. Admin Dashboard (Layout + Stats)

```
Restaurant management admin dashboard for a SaaS platform.

Layout:
- Left sidebar (collapsible to icon-only mode) with 3 nav groups:
  - Main: Dashboard, Orders, Products (with Lucide icons)
  - Operations: Categories, Kitchen Display, Team
  - Configuration: Stores, Payments, Languages, Design, Games, Settings
- Sidebar header: "BeInDigital" brand with crossed utensils icon and "Restaurant Admin" subtitle
- Sidebar footer: Store selector dropdown showing current restaurant name
- Top header bar: Hamburger toggle, breadcrumb trail, "Admin" badge right-aligned

Dashboard content area:
- 4 metric cards in a row: Revenue today (€), Orders today (#), Average basket (€), Active orders (#)
- Each card has an icon, title, large value, and subtle subtitle
- Below: Recent orders table (10 rows) with columns: Order #, Customer, Type badge (delivery/pickup/dine-in), Items count, Total, Status badge (color-coded), Date
- Quick actions section: 3 buttons (New Order, Add Product, View Kitchen)

Visual Style:
- Clean, professional SaaS aesthetic
- Orange primary accent (hsl 22 100% 50%), neutral grays
- Card-based layout with subtle shadows and rounded corners (0.5rem radius)
- Inter font for body, Poppins for headings
- Light mode with dark mode support

Platform: Responsive web (desktop 1440px, tablet 768px, mobile 375px)
```

---

## 2. Products Management

```
Product catalog management page for restaurant admin panel.

Key Features:
- Page header: "Products" title with "Add Product" primary button (right-aligned)
- Search bar with text input and category filter dropdown side by side
- Products data table with columns:
  - Thumbnail image (40x40 rounded)
  - Product name + category badge below
  - Price in euros (formatted from cents)
  - Stock status indicator (in stock / low / out)
  - Active/Inactive toggle switch
  - Actions dropdown (Edit, Duplicate, Delete)
- Pagination at bottom
- Empty state: Illustration + "No products yet" + CTA button

Product Form (separate screen):
- Multi-tab form: General Info | Options & Variants | Stock | Scheduling | Allergens
- General tab: Name, description (textarea), category (select), price (number input with € suffix), image upload zone
- Options tab: Dynamic list of option groups (e.g. "Size", "Extras") with name, type (single/multiple), required toggle, and nested choices with price modifiers
- Clean form layout with validation errors inline

Visual Style:
- Same orange/neutral theme as dashboard
- Table rows with hover state, alternating subtle backgrounds
- Status badges: green (active), gray (inactive), red (out of stock), yellow (low stock)
- Form sections with clear visual separation

Platform: Responsive web (desktop-first)
```

---

## 3. Orders Management

```
Order management interface for restaurant admin with real-time status tracking.

Orders List:
- Tab bar at top filtering by status: All, Pending, Confirmed, Preparing, Ready, Completed, Cancelled
- Each tab shows count badge
- Orders table with columns:
  - Order number (formatted #ORD-XXXX)
  - Customer name
  - Type badge: Delivery (blue), Pickup (green), Dine-in (purple)
  - Items summary (e.g. "3 items")
  - Total in euros
  - Status badge (color-coded: pending=yellow, confirmed=blue, preparing=orange, ready=green, completed=gray, cancelled=red)
  - Relative date ("2 min ago", "1h ago")

Order Detail (separate screen, 2-column layout):
- Left column (60%):
  - Order items list with product name, quantity, options, unit price, subtotal
  - Customer info card: name, phone, email, delivery address (if applicable)
- Right column (40%):
  - Order status timeline (vertical) with timestamps
  - Status action buttons: "Confirm", "Start Preparing", "Mark Ready", "Complete" (progressive, only showing next valid action)
  - Payment info card: method, status, amount

Visual Style:
- Status colors consistent across app
- Timeline with connected dots and lines
- Clean table with good data density
- Action buttons prominent with appropriate colors

Platform: Responsive web
```

---

## 4. Kitchen Display System (KDS)

```
Real-time kitchen display system (KDS) for restaurant with kanban board layout.

Layout:
- Full-width kanban board with 4 columns: Pending | In Progress | Ready | Completed
- Column headers with count badges
- Station filter bar at top (All, Grill, Fryer, Salad, Drinks)

Ticket Cards:
- Order number and source badge (POS, Uber Eats, Deliveroo, Website)
- List of items with quantities (bold quantity numbers)
- Priority indicator: Normal (no badge), Rush (red badge), VIP (gold badge)
- Live timer showing elapsed time since ticket creation
  - Green: < 10 minutes
  - Yellow: 10-20 minutes
  - Red: > 20 minutes (pulsing animation)
- Action button at bottom: "Start" (pending), "Ready" (in progress), "Complete" (ready)

Visual Style:
- High contrast, easy to read at distance (kitchen environment)
- Large text for item names and quantities
- Dark header bars per column
- Cards with clear visual hierarchy
- Timer prominently displayed
- Responsive: works on large screens (TV mounted in kitchen) and tablets

Platform: Responsive web (optimized for large displays 1920px+ and tablets)
```

---

## 5. Categories Management

```
Category management page for restaurant menu organization.

Key Features:
- Page header: "Categories" title with "Add Category" button
- Category list as reorderable cards (up/down arrow buttons for sort order)
- Each category card shows:
  - Drag handle icon (left)
  - Category name (bold) + slug below in muted text
  - Description (truncated, 1 line)
  - Product count badge
  - Active/Inactive status badge
  - Edit and Delete action buttons (right)
- Add/Edit category dialog (modal overlay):
  - Name input (auto-generates slug)
  - Slug input (read-only in create mode, editable in edit)
  - Description textarea
  - Active toggle switch
  - Save/Cancel buttons

Visual Style:
- Cards with subtle border, hover effect
- Sort arrows with clear affordance
- Modal with clean form layout
- Orange theme consistency

Platform: Responsive web
```

---

## 6. Team Management

```
Team member management page for restaurant staff.

Key Features:
- Page header: "Team" title with "Add Member" button
- Grid layout (3 columns desktop, 2 tablet, 1 mobile) of team member cards
- Each card shows:
  - Avatar (initials-based colored circle)
  - Full name
  - Role badge (Owner=purple, Manager=blue, Staff=gray, Kitchen=orange)
  - Active/Inactive status toggle
  - Edit and Remove buttons
- Add/Edit member dialog:
  - Name, Email inputs
  - Role select (Owner, Manager, Staff, Kitchen)
  - Active toggle
  - Permissions checkboxes (optional section)

Visual Style:
- Card grid with equal spacing
- Role badges with distinct colors
- Clean avatar placeholders
- Professional, HR-tool aesthetic

Platform: Responsive web
```

---

## 7. Store Management

```
Multi-store management interface for restaurant chain.

Stores List:
- Grid of store cards (2 columns desktop, 1 mobile)
- Each card shows:
  - Store name (large)
  - Address line
  - Status badge (Open=green, Closed=red, Coming Soon=yellow)
  - Phone number
  - "Manage" button
- "Add Store" card with dashed border and plus icon

Store Detail (tabbed interface):
- Tabs: General | Hours | Branding | Settings
- General tab: Name, address, phone, email, timezone
- Hours tab: 7-day grid with open/close time pickers, closed toggle per day
- Branding tab: Logo upload, color picker for primary/secondary colors, tagline
- Settings tab: Order types toggles (delivery, pickup, dine-in), minimum order amount, delivery radius

Visual Style:
- Store cards with location pin accent
- Hours grid clean and scannable
- Color pickers with hex input and visual preview
- Tab navigation clear and accessible

Platform: Responsive web
```

---

## 8. Payments Page

```
Payment transactions management for restaurant admin.

Key Features:
- Summary cards at top: Total Revenue, Pending Payments, Refunded Amount
- Filter bar: Status filter (All, Completed, Pending, Refunded, Failed), Payment provider filter (All, Stripe, Cash, SumUp, PayPal)
- Payments data table with columns:
  - Payment ID (truncated)
  - Order # (linked)
  - Amount in euros
  - Provider badge (Stripe=purple, Cash=green, SumUp=blue, PayPal=yellow)
  - Status badge (Completed=green, Pending=yellow, Refunded=orange, Failed=red)
  - Date
  - Actions: View, Refund button
- Refund dialog: Amount input (pre-filled with original), Reason textarea, Confirm button

Visual Style:
- Financial dashboard aesthetic
- Clear number formatting
- Provider icons/badges distinctive
- Confirmation dialogs for destructive actions

Platform: Responsive web
```

---

## 9. Languages & i18n

```
Language management page for multi-language restaurant platform with GPT auto-translation.

Key Features:
- Page header: "Languages" title with "Add Language" button
- Languages table with columns:
  - Flag emoji + Language name
  - Locale code (e.g. "fr", "en", "es")
  - Default language badge (star icon)
  - Active/Inactive toggle
  - Translation progress bar (e.g. 85% translated)
  - Actions: Set Default, Edit, Delete (disabled for default)
- Add Language dialog:
  - Language name input
  - Locale code input
  - Auto-translate toggle with GPT badge
  - "Add & Translate All" CTA button
- Translation cost indicator: "~$0.01 per page, ~$0.001 per product"

Visual Style:
- Clean table with flag emojis for visual scanning
- Progress bars with green fill
- GPT badge with subtle AI indicator
- Informational cost display

Platform: Responsive web
```

---

## 10. Design & Themes

```
Design customization page for restaurant theme management.

Key Features:
- Tabbed interface: Themes | Colors | Typography | Logo
- Themes tab:
  - 6 predefined theme cards in 3x2 grid:
    - Fast Food (red/yellow, bold)
    - Pizzeria (green/red, Italian)
    - Chinese (red/gold, ornate)
    - Fine Dining (black/gold, elegant)
    - Cafe (brown/cream, cozy)
    - Sushi (black/red, minimal Japanese)
  - Each card: Preview thumbnail, theme name, "Apply" button, checkmark on active theme
- Colors tab:
  - Color picker inputs for: Primary, Secondary, Accent, Background, Text
  - Each with hex input field and color swatch preview
  - Live preview panel on the right showing a mini storefront mockup
- Typography tab:
  - Heading font selector dropdown
  - Body font selector dropdown
  - Preview text blocks
- Logo tab:
  - Logo upload dropzone
  - Current logo preview
  - Size and position options

Visual Style:
- Creative, design-tool aesthetic
- Theme cards with real visual previews
- Color inputs with visual swatches
- Live preview panel for instant feedback

Platform: Responsive web (desktop-first)
```

---

## 11. Games & Gamification

```
Gamification management page for restaurant loyalty/engagement system.

Key Features:
- Tabbed interface: Configuration | QR Codes | Prizes | Play History
- Configuration tab:
  - Game toggle (enabled/disabled)
  - Win ratio slider (0-100%) with percentage display
  - Game type selector: Wheel of Fortune, Scratch Card
  - Cooldown setting: hours between plays (number input)
  - Required social actions checklist: Google Review, Instagram Follow, Facebook Like, TikTok Follow
- QR Codes tab:
  - List of generated QR codes with table number
  - "Generate QR Code" button
  - Each row: QR preview thumbnail, Table #, Scans count, Status, Download/Print buttons
- Prizes tab:
  - Prize cards grid: Name, Description, Stock remaining, Win probability weight
  - Add Prize dialog: Name, Description, Stock count, Probability weight slider
- Play History tab:
  - Table: Date, Customer, Game Played, Result (Won/Lost), Prize (if won), Redeemed status

Visual Style:
- Playful but professional
- Colorful prize cards
- QR code previews
- Win ratio slider with visual indicator
- History with clear won/lost visual distinction

Platform: Responsive web
```

---

## 12. Settings Page

```
General settings page for restaurant admin platform.

Key Features:
- Tabbed interface: General | Notifications | Integrations
- General tab:
  - Restaurant info section: Business name, description, contact email, phone
  - Currency selector
  - Timezone selector
  - Tax rate input (%)
  - Auto-accept orders toggle
- Notifications tab:
  - Email notification toggles: New orders, Order status changes, Low stock alerts, Daily summary
  - Sound notification toggles: New order sound, Kitchen alert sound
  - Each toggle with description text
- Integrations tab:
  - Integration cards for: Stripe, SumUp, PayPal, Square, Uber Eats, Deliveroo, Uber Direct
  - Each card: Service logo, Connection status (Connected=green / Not Connected=gray), "Configure" / "Connect" button
  - API key input fields (masked) per integration

Visual Style:
- Clean settings layout
- Toggle switches with clear labels
- Integration cards with service logos
- Masked API key inputs with show/hide toggle
- Organized sections with clear headers

Platform: Responsive web
```

---

## 13. Storefront - Menu Page (Customer-Facing)

```
Customer-facing restaurant menu browsing page.

Layout:
- Top navigation bar: Restaurant logo, menu link, cart icon with item count badge
- Hero section: Restaurant name, tagline, delivery/pickup toggle
- Category horizontal scrollbar (sticky): All, Burgers, Pizza, Drinks, Desserts...
- Product grid (3 columns desktop, 2 tablet, 1 mobile):
  - Each product card:
    - Food image (16:9 ratio, rounded top corners)
    - Product name
    - Short description (2 lines max, truncated)
    - Price (bold, orange)
    - "Add to Cart" button
    - Optional badges: "New", "Popular", "Spicy"
- Floating cart summary bar at bottom (mobile): "View Cart (3 items) - €24.90"

Visual Style:
- Warm, appetizing aesthetic
- Orange primary for CTAs and prices
- High-quality food photography placeholders
- Rounded cards with subtle shadow
- Smooth scroll between categories

Platform: Mobile-first responsive (375px to 1440px)
```

---

## 14. Storefront - Cart & Checkout

```
Shopping cart and multi-step checkout flow for restaurant ordering.

Cart Page:
- Cart items list with:
  - Product image thumbnail
  - Name + selected options
  - Quantity selector (+/- buttons)
  - Item subtotal
  - Remove button (X icon)
- Order summary sidebar (desktop) / bottom sheet (mobile):
  - Subtotal, delivery fee, taxes, total
  - Promo code input
  - "Proceed to Checkout" CTA button

Checkout Flow (3 steps with progress indicator):
1. Delivery/Pickup info: Address form or pickup time selector
2. Payment: Card input (Stripe Elements style), or select saved method, Apple Pay / Google Pay buttons
3. Confirmation: Order summary, estimated delivery time, order number, "Track Order" button

Visual Style:
- Clean, conversion-optimized
- Progress bar at top showing current step
- Trust signals near payment (secure badge, encrypted)
- Large, clear CTA buttons
- Orange accents for interactive elements
- Success confirmation with check animation

Platform: Mobile-first responsive
```

---

## 15. Gamification - Customer Game Flow

```
Customer-facing gamification flow for restaurant loyalty game.

Flow (4 screens):

Screen 1 - QR Code Landing:
- Restaurant branding header
- "Play & Win!" headline with animated sparkle effect
- Explanation: "Complete a quick action to unlock your game"
- Required action card: e.g. "Leave a Google Review" with star icons
- "I've completed the action" CTA button
- Terms and conditions link at bottom

Screen 2 - Game Selection / Play:
- Wheel of Fortune variant:
  - Large spinning wheel with colored segments (prizes and "Try Again")
  - "SPIN" button in center
  - Spinning animation with deceleration
- OR Scratch Card variant:
  - 3x3 grid of scratch-off areas
  - Touch/click to reveal (canvas-based scratch animation)
  - Match 3 to win

Screen 3a - Win Screen:
- Confetti animation
- "Congratulations!" headline
- Prize name and description
- Form: Name, Email, Phone
- "Claim Your Prize" button
- "You'll receive a QR code by email"

Screen 3b - Lose Screen:
- Sympathetic message: "Not this time!"
- "Try again tomorrow" with countdown timer
- Restaurant CTA: "Order now and get 10% off" (optional)

Visual Style:
- Fun, engaging, game-like aesthetic
- Bright colors with animations
- Restaurant branding throughout
- Mobile-optimized (most users scan QR from phone)
- Confetti/particle effects for wins

Platform: Mobile-first (375px primary, scales to desktop)
```

---

## Design Tokens Reference

All prompts use these consistent design tokens:

| Token | Light Mode | Dark Mode |
|-------|-----------|-----------|
| Primary | `hsl(22, 100%, 50%)` (orange) | `hsl(22, 100%, 55%)` |
| Background | `hsl(0, 0%, 100%)` (white) | `hsl(222, 84%, 4.9%)` |
| Card | `hsl(0, 0%, 100%)` | `hsl(222, 84%, 4.9%)` |
| Muted | `hsl(210, 40%, 96.1%)` | `hsl(217, 32.6%, 17.5%)` |
| Border | `hsl(214, 31.8%, 91.4%)` | `hsl(217, 32.6%, 17.5%)` |
| Destructive | `hsl(0, 84.2%, 60.2%)` | `hsl(0, 62.8%, 30.6%)` |
| Success | `hsl(142, 76%, 36%)` | same |
| Warning | `hsl(38, 92%, 50%)` | same |
| Info | `hsl(217, 91%, 60%)` | same |
| Border Radius | `0.5rem` | same |
| Font Body | Inter | same |
| Font Heading | Poppins | same |
