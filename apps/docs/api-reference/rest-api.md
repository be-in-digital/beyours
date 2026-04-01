# REST API Reference

> API routes for webhooks, file uploads, printing, and email handling.

## Table of Contents

- [Webhooks](#webhooks)
- [File Upload](#file-upload)
- [Kitchen Printing](#kitchen-printing)
- [Email](#email)
- [Gamification](#gamification)

## Webhooks

### Stripe Webhook

```
POST /api/webhooks/stripe
```

Handles Stripe payment events.

**Headers:**
| Header | Description |
|--------|-------------|
| `stripe-signature` | Stripe webhook signature |

**Events handled:**
- `payment_intent.succeeded` — Mark order as paid
- `payment_intent.payment_failed` — Mark order as failed
- `charge.refunded` — Process refund

### Uber Eats Webhook

```
POST /api/webhooks/uber-eats
```

Receives orders and status updates from Uber Eats.

### Deliveroo Webhook

```
POST /api/webhooks/deliveroo
```

Receives orders and status updates from Deliveroo.

## File Upload

### Upload Image

```
POST /api/upload
```

Upload files to AWS S3.

**Request:** `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| `file` | `File` | The file to upload |
| `folder` | `string` | S3 folder (`products`, `branding`, `stores`, `cms`) |

**Response:**

```json
{
  "url": "https://s3.eu-west-1.amazonaws.com/bucket/products/image.jpg",
  "key": "products/image.jpg"
}
```

## Kitchen Printing

### Print Ticket

```
POST /api/print
```

Send a kitchen ticket to a thermal printer.

**Body:**

```json
{
  "ticketId": "ticket_123",
  "printerId": "printer_456"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Ticket sent to Kitchen Printer 1"
}
```

## Email

### Send Transactional Email

```
POST /api/email/send
```

Send a transactional email via AWS SES.

**Body:**

```json
{
  "to": "customer@example.com",
  "subject": "Order Confirmed",
  "template": "order-confirmation",
  "data": {
    "orderNumber": "ORD-123",
    "items": [...],
    "total": "24.99"
  }
}
```

### Verify Email Subscription

```
GET /api/email/verify?token=xxx
```

Verify a double opt-in email subscription.

### Unsubscribe

```
GET /api/email/unsubscribe?token=xxx
```

Unsubscribe from email marketing.

## Gamification

### Game Page

```
GET /game/[qrCodeId]
```

The customer-facing game page. Redirected from QR code scan.

### Redeem Prize

```
POST /api/prizes/redeem
```

Redeem a prize using the QR code.

**Body:**

```json
{
  "redemptionCode": "PRIZE-ABC123"
}
```

**Response:**

```json
{
  "success": true,
  "prize": {
    "name": "Free Dessert",
    "description": "Any dessert from our menu"
  }
}
```

## Authentication

All API routes (except webhooks and public game pages) require authentication via the `Authorization` header or session cookie.

```
Authorization: Bearer <session_token>
```

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ]
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Not authenticated |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 422 | Invalid input |
| `INTERNAL_ERROR` | 500 | Server error |
