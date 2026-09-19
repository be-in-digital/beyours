# Email Marketing Guide

> Build and send email campaigns with 28 block types, segmentation, and analytics.

## Table of Contents

- [Overview](#overview)
- [Setup](#setup)
- [Creating Campaigns](#creating-campaigns)
- [Email Templates](#email-templates)
- [Subscriber Management](#subscriber-management)
- [Segmentation](#segmentation)
- [Analytics](#analytics)

## Overview

The email marketing system provides a complete solution:

- **Visual email builder** with 28 block types
- **Subscriber management** with double opt-in
- **Segmentation** for targeted campaigns
- **Statistics** (open rate, click rate, bounce rate)
- **CSV import** for bulk subscriber upload

## Setup

```bash
pnpm add @be-yours/marketing @be-yours/core
```

### AWS SES Configuration

```env
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_SES_FROM_EMAIL=newsletter@yourdomain.com
```

## Creating Campaigns

### Admin Dashboard

The `EmailDashboardPage` provides a full campaign management UI:

```tsx
import { EmailDashboardPage } from "@be-yours/admin/pages";

export default function EmailAdmin() {
  return <EmailDashboardPage />;
}
```

### Programmatic

```typescript
import { renderTemplateToEmailHtml, validateCampaign } from "@be-yours/marketing";
import { getSESService } from "@be-yours/core";

// 1. Build email content
const html = renderTemplateToEmailHtml({
  subject: "This Week's Special",
  blocks: [
    { type: "header", data: { logo: logoUrl, title: "Weekly Special" } },
    { type: "hero-image", data: { src: heroUrl } },
    { type: "text", data: { content: "Check out our special this week!" } },
    { type: "cta-button", data: { text: "Order Now", url: orderUrl } },
    { type: "footer", data: { unsubscribeUrl: "{{unsubscribe_url}}" } },
  ],
});

// 2. Validate
const validation = validateCampaign({ subject: "...", blocks: [...] });
if (!validation.valid) throw new Error(validation.errors.join(", "));

// 3. Send — sendEmail is a method on the SES service, not a free function
const ses = getSESService();
for (const subscriber of subscribers) {
  await ses.sendEmail({
    to: subscriber.email,
    subject: "This Week's Special",
    html: html.replace("{{unsubscribe_url}}", getUnsubUrl(subscriber)),
  });
}
```

## Email Templates

### 28 Block Types

| Category | Blocks |
|----------|--------|
| **Structure** | header, footer, spacer, divider, two-columns, three-columns |
| **Content** | text, heading, image, video, quote |
| **Action** | cta-button, social-links |
| **Product** | product-card, product-grid, menu-item |
| **Commerce** | coupon, countdown, order-summary |
| **Brand** | hero-image, map |

## Subscriber Management

### Double Opt-In

```typescript
import { generateDoubleOptInToken } from "@be-yours/marketing";
import { getSESService } from "@be-yours/core";

// 1. Customer signs up
const token = generateDoubleOptInToken(email);

// 2. Send verification email
await getSESService().sendEmail({
  to: email,
  subject: "Confirm your subscription",
  html: `<a href="https://yourdomain.com/api/email/verify?token=${token}">Confirm</a>`,
});

// 3. Handle verification
// app/api/email/verify/route.ts
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  await verifySubscriber(token);
  return redirect("/subscribed");
}
```

### CSV Import

```typescript
import { parseSubscriberCsv } from "@be-yours/marketing";

const subscribers = parseSubscriberCsv(csvContent);
// Validates emails, deduplicates, normalizes
// [{ email: "...", name: "...", tags: [...] }]
```

## Segmentation

Target specific subscriber groups:

```typescript
import { buildSegmentFilter } from "@be-yours/marketing";

// VIP customers who ordered recently
const filter = buildSegmentFilter({
  rules: [
    { field: "totalOrders", operator: "gte", value: 5 },
    { field: "lastOrderDate", operator: "after", value: "2026-03-01" },
  ],
  match: "all",
});
```

### Available Operators

| Operator | Description |
|----------|-------------|
| `eq` | Equals |
| `neq` | Not equals |
| `gt` / `gte` | Greater than (or equal) |
| `lt` / `lte` | Less than (or equal) |
| `includes` | Array contains value |
| `before` / `after` | Date comparison |

## Analytics

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

// stats.openRate = 35.7%
// stats.clickRate = 12.2%
// stats.bounceRate = 2.0%
```
