# @be-yours/marketing

> Email marketing: HTML rendering with 28 block types, campaign validation, segmentation, double opt-in, statistics, CSV import.

## Table of Contents

- [Installation](#installation)
- [Email Rendering](#email-rendering)
- [Campaign Validation](#campaign-validation)
- [Segmentation](#segmentation)
- [Subscriber Management](#subscriber-management)
- [Statistics](#statistics)

## Installation

```bash
pnpm add @be-yours/marketing
```

## Email Rendering

Render email templates to HTML with 28 block types.

```typescript
import { renderTemplateToEmailHtml } from "@be-yours/marketing";

const html = renderTemplateToEmailHtml({
  subject: "Spring Menu Launch",
  blocks: [
    {
      type: "header",
      data: { logo: "https://...", title: "New Spring Menu" },
    },
    {
      type: "hero-image",
      data: { src: "https://...", alt: "Spring dishes" },
    },
    {
      type: "text",
      data: { content: "Discover our new seasonal dishes..." },
    },
    {
      type: "product-grid",
      data: {
        products: [
          { name: "Spring Salad", price: "12.99", image: "..." },
          { name: "Herb Risotto", price: "16.99", image: "..." },
        ],
      },
    },
    {
      type: "cta-button",
      data: { text: "Order Now", url: "https://..." },
    },
    {
      type: "footer",
      data: { unsubscribeUrl: "{{unsubscribe_url}}" },
    },
  ],
  styles: {
    primaryColor: "#e74c3c",
    fontFamily: "Arial, sans-serif",
  },
});
```

### Block Types

| Block | Description |
|-------|-------------|
| `header` | Email header with logo |
| `footer` | Footer with unsubscribe link |
| `hero-image` | Full-width hero image |
| `text` | Rich text content |
| `heading` | Section heading |
| `spacer` | Vertical spacing |
| `divider` | Horizontal line |
| `cta-button` | Call-to-action button |
| `product-grid` | Product showcase grid |
| `product-card` | Single product card |
| `image` | Image with optional link |
| `two-columns` | Two-column layout |
| `three-columns` | Three-column layout |
| `social-links` | Social media icons |
| `coupon` | Discount coupon block |
| `countdown` | Countdown timer |
| `video` | Video thumbnail |
| `quote` | Customer testimonial |
| `menu-item` | Restaurant menu item |
| `order-summary` | Order recap |
| `map` | Store location map |
| ...and more | |

## Campaign Validation

Validate campaigns before sending:

```typescript
import { validateCampaign } from "@be-yours/marketing";

const result = validateCampaign({
  subject: "Spring Menu",
  senderName: "La Bella",
  senderEmail: "info@labella.com",
  blocks: [...],
  recipientSegment: "all",
});

if (!result.valid) {
  console.error(result.errors);
  // ["Missing unsubscribe link in footer"]
}
```

## Segmentation

Build subscriber filters for targeted campaigns:

```typescript
import { buildSegmentFilter } from "@be-yours/marketing";

const filter = buildSegmentFilter({
  rules: [
    { field: "lastOrderDate", operator: "after", value: "2026-01-01" },
    { field: "totalOrders", operator: "gte", value: 3 },
    { field: "tags", operator: "includes", value: "vip" },
  ],
  match: "all", // "all" = AND, "any" = OR
});

// Use filter with Convex query
const subscribers = await ctx.db.query("emailSubscribers").filter(filter).collect();
```

## Subscriber Management

### Double Opt-In

```typescript
import { generateDoubleOptInToken } from "@be-yours/marketing";

// Generate verification token
const token = generateDoubleOptInToken(email);

// Send verification email with link:
// https://yourdomain.com/api/email/verify?token=xxx
```

### CSV Import

```typescript
import { parseSubscriberCsv } from "@be-yours/marketing";

const subscribers = parseSubscriberCsv(csvContent);
// [{ email: "...", name: "...", tags: [...] }, ...]

// Validates email format, deduplicates, and normalizes data
```

## Statistics

```typescript
import { computeStatRates } from "@be-yours/marketing";

const stats = computeStatRates({
  sent: 1000,
  delivered: 980,
  opened: 350,
  clicked: 120,
  bounced: 20,
  unsubscribed: 5,
});

// {
//   deliveryRate: 98.0,
//   openRate: 35.7,
//   clickRate: 12.2,
//   clickToOpenRate: 34.3,
//   bounceRate: 2.0,
//   unsubscribeRate: 0.5,
// }
```
