# Migration Approche B : Queue externe pour gros volumes

## Contexte

L'Approche A actuelle envoie les emails directement depuis des Convex Actions avec un rate limiting de ~10 emails/sec (100ms delay entre chaque envoi). Cette approche fonctionne bien pour des volumes jusqu'a ~5 000 abonnees par campagne.

Pour des volumes superieurs (10K+ abonnees), il est recommande de migrer vers une architecture avec queue externe.

## Architecture actuelle (Approche A)

```
[Admin UI] --> [Convex Action: emailCampaignActions.send]
                  |
                  |--> Fetch subscribers (query)
                  |--> Render HTML per subscriber (marketing utils)
                  |--> Send via SES (direct SDK call, 100ms delay)
                  |--> Record events (internal mutations)
                  |--> Update campaign stats
```

**Limites :**
- Convex Action timeout (10 min max)
- Single-threaded, ~10 emails/sec = ~6 000 emails max par action
- Pas de retry automatique pour les echecs individuels
- Pas de backpressure SES

## Architecture cible (Approche B)

```
[Admin UI] --> [Convex Action: emailCampaignActions.send]
                  |
                  |--> Fetch subscribers
                  |--> Push batches to SQS queue
                  |
[SQS Queue] --> [Lambda Worker / ECS Task]
                  |
                  |--> Render HTML per subscriber
                  |--> Send via SES
                  |--> Call Convex HTTP endpoint to record events
```

## Plan de migration

### 1. Infrastructure AWS

- Creer une queue SQS (FIFO ou Standard selon les besoins)
- Creer un Lambda Worker (ou ECS Fargate task pour les tres gros volumes)
- Configurer les dead-letter queues pour les echecs
- Configurer IAM roles et policies

### 2. Format du message SQS

```json
{
  "campaignId": "xxx",
  "storeId": "xxx",
  "batch": [
    {
      "subscriberId": "xxx",
      "email": "alice@example.com",
      "firstName": "Alice"
    }
  ],
  "templateBlocks": [...],
  "branding": {...},
  "subject": "Votre offre du jour"
}
```

### 3. Modifications Convex

**`emailCampaignActions.send`** :
- Au lieu d'envoyer directement, decouper les abonnes en batches de 100
- Pousser chaque batch dans SQS via le SDK AWS
- Marquer la campagne comme "sending"

**Nouvel endpoint HTTP** `/webhooks/email-worker` :
- Recoit les resultats d'envoi du worker
- Met a jour les stats de campagne et enregistre les events

### 4. Worker Lambda

```typescript
// handler.ts
export async function handler(event: SQSEvent) {
  for (const record of event.Records) {
    const message = JSON.parse(record.body)

    for (const subscriber of message.batch) {
      const html = renderTemplateToEmailHtml(
        message.templateBlocks,
        { ...message.branding, unsubscribeUrl: `...` }
      )

      await sesClient.send(new SendEmailCommand({
        Destination: { ToAddresses: [subscriber.email] },
        Content: { Simple: { Subject: { Data: message.subject }, Body: { Html: { Data: html } } } }
      }))
    }

    // Report results back to Convex
    await fetch(`${CONVEX_HTTP_URL}/webhooks/email-worker`, {
      method: "POST",
      body: JSON.stringify({ campaignId: message.campaignId, sent: message.batch.length })
    })
  }
}
```

### 5. Avantages de l'Approche B

| Aspect | Approche A | Approche B |
|--------|-----------|-----------|
| Volume max | ~5 000/campagne | Illimite |
| Throughput | ~10/sec | ~100-1000/sec (parallelisme Lambda) |
| Timeout | 10 min Convex | Pas de limite |
| Retry | Manuel | Automatique (SQS retry + DLQ) |
| Backpressure | Non | Oui (SQS + SES throttling) |
| Cout infra | $0 (Convex inclus) | ~$5-20/mois (SQS + Lambda) |
| Complexite | Faible | Moyenne |

### 6. Criteres de migration

Migrer vers l'Approche B quand :
- Un client depasse regulierement 5 000 abonnes actifs
- Le taux d'echec SES depasse 1% (signe de throttling)
- Les campagnes prennent plus de 5 minutes a envoyer

### 7. Compatibilite

La migration est **transparente pour le frontend** :
- L'API Convex reste identique (meme mutation `emailCampaignActions.send`)
- Le tracking SES webhook reste identique (meme endpoint `/webhooks/ses`)
- Les stats et events sont mis a jour de la meme facon

Seule la couche d'envoi change : direct SES -> SQS -> Lambda -> SES.

## Estimation

- Infrastructure : 2-3 jours
- Code worker : 1-2 jours
- Modifications Convex : 1 jour
- Tests integration : 1-2 jours
- **Total : ~1 semaine**
