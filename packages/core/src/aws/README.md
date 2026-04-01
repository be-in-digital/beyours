# Services AWS - @be-in-digital/core

Services pour S3 (stockage de fichiers) et SES (envoi d'emails) avec architecture injectable.

## Architecture

Les services AWS utilisent une architecture **injectable** : vous fournissez votre propre client AWS SDK lors de la création du service. Cela permet :
- **Testabilité** : injection de mocks pour les tests
- **Flexibilité** : utilisation de différentes versions du SDK
- **Pas de dépendances** : le package core ne dépend pas du SDK AWS

## Service S3

### Installation du SDK AWS

```bash
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### Création du service

```typescript
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createS3Service } from '@be-in-digital/core/aws'
import type { S3Operations } from '@be-in-digital/core/aws'

// Configuration
const config = {
  region: 'eu-west-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  bucketName: 'my-bucket',
  publicBaseUrl: 'https://cdn.example.com', // optionnel
}

// Client AWS SDK
const s3Client = new S3Client({
  region: config.region,
  credentials: {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  },
})

// Adapter AWS SDK vers S3Operations
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

// Création du service
const s3Service = createS3Service(config, s3Operations)
```

### Utilisation

#### Upload de fichier

```typescript
const file = Buffer.from('...')

const result = await s3Service.upload(file, {
  folder: 'products', // 'products' | 'branding' | 'stores' | 'cms'
  contentType: 'image/jpeg',
  filename: 'product-123', // optionnel
  metadata: { productId: '123' }, // optionnel
})

console.log(result)
// {
//   key: 'products/product-123.jpg',
//   url: 'https://cdn.example.com/products/product-123.jpg',
//   size: 102400
// }
```

#### URL presignée pour upload direct

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

// Le client peut maintenant uploader directement
await fetch(presigned.uploadUrl, {
  method: 'PUT',
  body: file,
  headers: { 'Content-Type': 'image/png' },
})
```

#### Autres opérations

```typescript
// URL publique
const url = s3Service.getPublicUrl('products/abc123.jpg')

// URL de téléchargement presignée
const download = await s3Service.getPresignedDownloadUrl('products/abc123.jpg', 3600)

// Vérifier l'existence
const exists = await s3Service.exists('products/abc123.jpg')

// Métadonnées
const metadata = await s3Service.getMetadata('products/abc123.jpg')

// Suppression
await s3Service.delete('products/abc123.jpg')
```

### Validation

Les types MIME et tailles sont automatiquement validés :

```typescript
// ✅ Accepté
await s3Service.upload(file, {
  folder: 'products',
  contentType: 'image/jpeg', // OK pour products
})

// ❌ Rejeté - PDF non autorisé pour products
await s3Service.upload(file, {
  folder: 'products',
  contentType: 'application/pdf', // Erreur!
})

// ✅ Accepté - PDF autorisé pour cms
await s3Service.upload(file, {
  folder: 'cms',
  contentType: 'application/pdf', // OK
})
```

**Tailles maximales par défaut :**
- `products`, `branding`, `stores` : 10 MB
- `cms` : 25 MB

**Types MIME autorisés :**
- Images : `image/jpeg`, `image/jpg`, `image/png`, `image/webp`, `image/svg+xml`
- Documents (cms uniquement) : `application/pdf`

---

## Service SES

### Installation du SDK AWS

```bash
pnpm add @aws-sdk/client-ses
```

### Création du service

```typescript
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import { createSESService } from '@be-in-digital/core/aws'
import type { SESOperations } from '@be-in-digital/core/aws'

// Configuration
const config = {
  region: 'eu-west-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  fromEmail: 'noreply@example.com',
  fromName: 'BeInDigital',
  replyToEmail: 'support@example.com',
}

// Client AWS SDK
const sesClient = new SESClient({
  region: config.region,
  credentials: {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  },
})

// Adapter AWS SDK vers SESOperations
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
    // Non utilisé par le service car les templates sont gérés en interne
    throw new Error('Not implemented')
  },
}

// Création du service
const sesService = createSESService(config, sesOperations)
```

### Utilisation

#### Email simple

```typescript
await sesService.sendEmail({
  to: 'customer@example.com',
  subject: 'Bienvenue !',
  html: '<h1>Bienvenue</h1><p>Merci de votre inscription.</p>',
  text: 'Bienvenue ! Merci de votre inscription.',
  replyTo: 'contact@example.com', // optionnel
})
```

#### Email avec template

```typescript
// Confirmation de commande
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

// Réinitialisation de mot de passe
await sesService.sendTemplatedEmail({
  to: 'user@example.com',
  templateName: 'passwordReset',
  templateData: {
    userName: 'Jane Doe',
    resetLink: 'https://example.com/reset?token=xyz',
    expirationTime: '24 heures',
  },
})

// Bienvenue
await sesService.sendTemplatedEmail({
  to: 'newuser@example.com',
  templateName: 'welcome',
  templateData: {
    userName: 'Alice',
    dashboardLink: 'https://example.com/dashboard',
  },
})

// Prix gagné
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

#### Envoi en masse

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
    // ... jusqu'à des milliers
  ],
  replyTo: 'contact@example.com',
})

// Résultat avec succès/erreurs
console.log(result.results)
// [
//   { to: 'user1@example.com', messageId: 'abc123' },
//   { to: 'user2@example.com', error: 'Invalid email' },
// ]
```

**Rate limiting automatique** : Le service envoie max 14 emails/seconde (limite SES sandbox) et divise les envois en lots de 50.

### Templates disponibles

1. **orderConfirmation** : Confirmation de commande
2. **passwordReset** : Réinitialisation de mot de passe
3. **welcome** : Email de bienvenue
4. **prizeWon** : Notification de prix gagné

Chaque template génère automatiquement :
- Sujet personnalisé
- Contenu HTML responsive
- Contenu texte (fallback)

---

## Tests

Les services incluent des tests complets (100% de couverture) :

```bash
# Tous les tests AWS
pnpm --filter @be-in-digital/core test -- src/aws

# Tests S3 uniquement
pnpm --filter @be-in-digital/core test -- src/aws/__tests__/s3.test.ts

# Tests SES uniquement
pnpm --filter @be-in-digital/core test -- src/aws/__tests__/ses.test.ts

# Tests templates uniquement
pnpm --filter @be-in-digital/core test -- src/aws/__tests__/templates.test.ts
```

---

## Bonnes pratiques

### S3

1. **Toujours valider le type MIME** avant upload (fait automatiquement)
2. **Utiliser des noms de fichiers uniques** (UUID par défaut)
3. **Configurer un CloudFront** pour `publicBaseUrl`
4. **Activer CORS** sur le bucket pour les uploads directs
5. **Définir une politique de lifecycle** pour nettoyer les fichiers anciens

### SES

1. **Toujours fournir un texte alternatif** pour les clients email sans HTML
2. **Tester les emails** dans différents clients (Gmail, Outlook, etc.)
3. **Sortir du sandbox SES** en production (limite de 14 emails/s)
4. **Configurer SPF, DKIM, DMARC** pour améliorer la délivrabilité
5. **Gérer les bounces et plaintes** via SNS

### Sécurité

1. **Ne jamais exposer les clés AWS** côté client
2. **Utiliser IAM roles** en production plutôt que des clés
3. **Limiter les permissions** au strict nécessaire
4. **Chiffrer les fichiers sensibles** sur S3
5. **Valider toutes les entrées** utilisateur avant envoi

---

## Variables d'environnement

```bash
# AWS
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx

# S3
AWS_S3_BUCKET_NAME=my-bucket
AWS_S3_PUBLIC_BASE_URL=https://cdn.example.com # optionnel

# SES
AWS_SES_FROM_EMAIL=noreply@example.com
AWS_SES_FROM_NAME=BeInDigital
AWS_SES_REPLY_TO_EMAIL=support@example.com
```
