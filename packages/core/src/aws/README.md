# AWS Services - @be-in-digital/core

Services for S3 (file storage) and SES (email sending) with an injectable architecture.

## Architecture

The AWS services use an **injectable** architecture: you supply your own AWS SDK client when creating the service. This gives you:
- **Testability**: inject mocks in tests
- **Flexibility**: use different SDK versions
- **No dependencies**: the core package does not depend on the AWS SDK

## S3 Service

### Installing the AWS SDK

```bash
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### Creating the service

```typescript
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createS3Service } from '@be-in-digital/core'
import type { S3Operations } from '@be-in-digital/core'

// Configuration
const config = {
  region: 'eu-west-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  bucketName: 'my-bucket',
  publicBaseUrl: 'https://cdn.example.com', // optional
}

// AWS SDK client
const s3Client = new S3Client({
  region: config.region,
  credentials: {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  },
})

// Adapter from the AWS SDK to S3Operations
const s3Operations: S3Operations = {
  async putObject({ key, body, contentType, metadata }) {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: config.bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
        Metadata: metadata,
      })
    )
  },

  async deleteObject({ key }) {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      })
    )
  },

  async getSignedUrl({ key, expiresIn, operation }) {
    const command = operation === 'putObject'
      ? new PutObjectCommand({ Bucket: config.bucketName, Key: key })
      : new GetObjectCommand({ Bucket: config.bucketName, Key: key })

    return await getSignedUrl(s3Client, command, { expiresIn })
  },

  async headObject({ key }) {
    const response = await s3Client.send(
      new HeadObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      })
    )

    return {
      size: response.ContentLength ?? 0,
      contentType: response.ContentType ?? 'application/octet-stream',
      lastModified: response.LastModified ?? new Date(),
      metadata: response.Metadata,
    }
  },
}

// Create the service
const s3Service = createS3Service(config, s3Operations)
```

### Usage

#### File upload

```typescript
const file = Buffer.from('...')

const result = await s3Service.upload(file, {
  folder: 'products', // 'products' | 'branding' | 'stores' | 'cms'
  contentType: 'image/jpeg',
  filename: 'product-123', // optional
  metadata: { productId: '123' }, // optional
})

console.log(result)
// {
//   key: 'products/product-123.jpg',
//   url: 'https://cdn.example.com/products/product-123.jpg',
//   size: 102400
// }
```

#### Presigned URL for direct upload

```typescript
const presigned = await s3Service.getPresignedUploadUrl({
  folder: 'products',
  contentType: 'image/png',
})

console.log(presigned)
// {
//   uploadUrl: 'https://s3.amazonaws.com/...',
//   key: 'products/abc123.png',
//   expiresAt: Date
// }

// The client can now upload directly
await fetch(presigned.uploadUrl, {
  method: 'PUT',
  body: file,
  headers: { 'Content-Type': 'image/png' },
})
```

#### Other operations

```typescript
// URL the browser should request. The bucket is private, so this is the CDN
// when `publicBaseUrl` is set, and the app's `/api/files` proxy otherwise —
// never the direct S3 endpoint. See aws/media-url.
const url = s3Service.getPublicUrl('products/abc123.jpg')

// Presigned download URL
const download = await s3Service.getPresignedDownloadUrl('products/abc123.jpg', 3600)

// Check existence
const exists = await s3Service.exists('products/abc123.jpg')

// Metadata
const metadata = await s3Service.getMetadata('products/abc123.jpg')

// Delete
await s3Service.delete('products/abc123.jpg')
```

### Validation

MIME types and sizes are validated automatically:

```typescript
// ✅ Accepted
await s3Service.upload(file, {
  folder: 'products',
  contentType: 'image/jpeg', // OK for products
})

// ❌ Rejected - PDF not allowed for products
await s3Service.upload(file, {
  folder: 'products',
  contentType: 'application/pdf', // Error!
})

// ✅ Accepted - PDF allowed for cms
await s3Service.upload(file, {
  folder: 'cms',
  contentType: 'application/pdf', // OK
})
```

**Default maximum sizes:**
- `products`, `branding`, `stores`: 10 MB
- `cms`: 25 MB

**Allowed MIME types:**
- Images: `image/jpeg`, `image/jpg`, `image/png`, `image/webp`, `image/svg+xml`
- Documents (cms only): `application/pdf`

---

## SES Service

### Installing the AWS SDK

```bash
pnpm add @aws-sdk/client-ses
```

### Creating the service

```typescript
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import { createSESService } from '@be-in-digital/core'
import type { SESOperations } from '@be-in-digital/core'

// Configuration
const config = {
  region: 'eu-west-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  fromEmail: 'noreply@example.com',
  fromName: 'BeYours',
  replyToEmail: 'support@example.com',
}

// AWS SDK client
const sesClient = new SESClient({
  region: config.region,
  credentials: {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  },
})

// Adapter from the AWS SDK to SESOperations
const sesOperations: SESOperations = {
  async sendEmail({ from, to, subject, html, text, replyTo }) {
    const recipients = Array.isArray(to) ? to : [to]

    const response = await sesClient.send(
      new SendEmailCommand({
        Source: from,
        Destination: {
          ToAddresses: recipients,
        },
        Message: {
          Subject: { Data: subject },
          Body: {
            Html: { Data: html },
            Text: text ? { Data: text } : undefined,
          },
        },
        ReplyToAddresses: replyTo ? [replyTo] : undefined,
      })
    )

    return { messageId: response.MessageId ?? '' }
  },

  async sendTemplatedEmail({ from, to, templateName, templateData, replyTo }) {
    // Not used by the service: templates are handled internally
    throw new Error('Not implemented')
  },
}

// Create the service
const sesService = createSESService(config, sesOperations)
```

### Usage

#### Simple email

```typescript
await sesService.sendEmail({
  to: 'customer@example.com',
  subject: 'Bienvenue !',
  html: '<h1>Bienvenue</h1><p>Merci de votre inscription.</p>',
  text: 'Bienvenue ! Merci de votre inscription.',
  replyTo: 'contact@example.com', // optional
})
```

#### Templated email

```typescript
// Order confirmation
await sesService.sendTemplatedEmail({
  to: 'customer@example.com',
  templateName: 'orderConfirmation',
  templateData: {
    orderNumber: 'ORD-12345',
    customerName: 'John Doe',
    items: [
      { name: 'Pizza', quantity: 2, price: 12.5 },
      { name: 'Drink', quantity: 1, price: 3.5 },
    ],
    total: 28.5,
    address: '123 Main St, Paris',
  },
})

// Password reset
await sesService.sendTemplatedEmail({
  to: 'user@example.com',
  templateName: 'passwordReset',
  templateData: {
    userName: 'Jane Doe',
    resetLink: 'https://example.com/reset?token=xyz',
    expirationTime: '24 heures',
  },
})

// Welcome
await sesService.sendTemplatedEmail({
  to: 'newuser@example.com',
  templateName: 'welcome',
  templateData: {
    userName: 'Alice',
    dashboardLink: 'https://example.com/dashboard',
  },
})

// Prize won
await sesService.sendTemplatedEmail({
  to: 'winner@example.com',
  templateName: 'prizeWon',
  templateData: {
    customerName: 'Bob',
    prizeName: 'Dessert gratuit',
    qrCode: 'https://example.com/qr/abc123.png',
    expirationDate: '2026-03-15',
  },
})
```

#### Bulk sending

```typescript
const result = await sesService.sendBulkEmail({
  recipients: [
    {
      to: 'user1@example.com',
      subject: 'Newsletter Mars 2026',
      html: '<h1>Newsletter</h1><p>Contenu...</p>',
    },
    {
      to: 'user2@example.com',
      subject: 'Newsletter Mars 2026',
      html: '<h1>Newsletter</h1><p>Contenu...</p>',
    },
    // ... up to thousands
  ],
  replyTo: 'contact@example.com',
})

// Result with successes/errors
console.log(result.results)
// [
//   { to: 'user1@example.com', messageId: 'abc123' },
//   { to: 'user2@example.com', error: 'Invalid email' },
// ]
```

**Automatic rate limiting**: the service sends at most 14 emails/second (SES sandbox limit) and splits sends into batches of 50.

### Available templates

1. **orderConfirmation**: order confirmation
2. **passwordReset**: password reset
3. **welcome**: welcome email
4. **prizeWon**: prize-won notification

Every template automatically generates:
- A personalized subject
- Responsive HTML content
- Plain-text content (fallback)

---

## Tests

The services come with full tests (100% coverage):

```bash
# All AWS tests
pnpm --filter @be-in-digital/core test -- src/aws

# S3 tests only
pnpm --filter @be-in-digital/core test -- src/aws/__tests__/s3.test.ts

# SES tests only
pnpm --filter @be-in-digital/core test -- src/aws/__tests__/ses.test.ts

# Template tests only
pnpm --filter @be-in-digital/core test -- src/aws/__tests__/templates.test.ts
```

---

## Best practices

### S3

1. **Keep the bucket private** — block all public access, grant `s3:GetObject`
   to the deployment's IAM user only. See
   [S3 bucket policy](../../../../apps/docs/deployment/s3-bucket-policy.md)
2. **Always validate the MIME type** before upload (done automatically)
3. **Use unique filenames** (UUID by default)
4. **Set up CloudFront** with an origin access control, and point
   `publicBaseUrl` at it — the bucket stays closed to the public internet
5. **Enable CORS** on the bucket for direct uploads (`PUT` only)
6. **Define a lifecycle policy** to clean up old files

### SES

1. **Always provide a plain-text alternative** for email clients without HTML
2. **Test emails** in different clients (Gmail, Outlook, etc.)
3. **Move out of the SES sandbox** in production (14 emails/s limit)
4. **Configure SPF, DKIM, DMARC** to improve deliverability
5. **Handle bounces and complaints** via SNS

### Security

1. **Never expose AWS keys** on the client side
2. **Use IAM roles** in production rather than keys
3. **Restrict permissions** to the strict minimum
4. **Encrypt sensitive files** on S3
5. **Validate all user input** before sending

---

## Environment variables

```bash
# AWS
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx

# S3
AWS_S3_BUCKET_NAME=my-bucket
AWS_S3_PUBLIC_BASE_URL=https://cdn.example.com # optional

# SES
AWS_SES_FROM_EMAIL=noreply@example.com
AWS_SES_FROM_NAME=BeYours
AWS_SES_REPLY_TO_EMAIL=support@example.com
```
