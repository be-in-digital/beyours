/**
 * Templates d'email pour SES
 * @module aws/ses/templates
 */

/**
 * Interface générique pour un template d'email
 */
export interface EmailTemplate<T = Record<string, unknown>> {
  /** Nom du template */
  name: string
  /** Fonction générant le sujet */
  subject: (data: T) => string
  /** Fonction générant le contenu HTML */
  html: (data: T) => string
  /** Fonction générant le contenu texte */
  text: (data: T) => string
}

/**
 * Données pour le template de confirmation de commande
 */
export interface OrderConfirmationData {
  orderNumber: string
  items: Array<{
    name: string
    quantity: number
    price: number
  }>
  total: number
  address: string
  customerName: string
}

/**
 * Template de confirmation de commande
 */
export const orderConfirmationTemplate: EmailTemplate<OrderConfirmationData> = {
  name: 'orderConfirmation',
  subject: (data) => `Commande confirmée - #${data.orderNumber}`,
  html: (data) => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .order-items { margin: 20px 0; }
          .item { padding: 10px; border-bottom: 1px solid #ddd; }
          .total { font-size: 18px; font-weight: bold; margin-top: 20px; text-align: right; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Commande confirmée !</h1>
          </div>
          <div class="content">
            <p>Bonjour ${data.customerName},</p>
            <p>Votre commande <strong>#${data.orderNumber}</strong> a été confirmée.</p>

            <div class="order-items">
              <h3>Articles commandés :</h3>
              ${data.items
                .map(
                  (item) => `
                <div class="item">
                  <strong>${item.name}</strong> x ${item.quantity} - ${item.price.toFixed(2)}€
                </div>
              `
                )
                .join('')}
            </div>

            <div class="total">
              Total : ${data.total.toFixed(2)}€
            </div>

            <p><strong>Adresse de livraison :</strong><br>${data.address}</p>
          </div>
          <div class="footer">
            <p>Merci de votre confiance !</p>
          </div>
        </div>
      </body>
    </html>
  `,
  text: (data) => `
Commande confirmée - #${data.orderNumber}

Bonjour ${data.customerName},

Votre commande #${data.orderNumber} a été confirmée.

Articles commandés :
${data.items.map((item) => `- ${item.name} x ${item.quantity} - ${item.price.toFixed(2)}€`).join('\n')}

Total : ${data.total.toFixed(2)}€

Adresse de livraison :
${data.address}

Merci de votre confiance !
  `.trim(),
}

/**
 * Données pour le template de réinitialisation de mot de passe
 */
export interface SESPasswordResetData {
  resetLink: string
  expirationTime: string
  userName: string
}

/**
 * Template de réinitialisation de mot de passe
 */
export const passwordResetTemplate: EmailTemplate<SESPasswordResetData> = {
  name: 'passwordReset',
  subject: () => 'Réinitialisation de votre mot de passe',
  html: (data) => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2196F3; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background: #2196F3; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .warning { background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Réinitialisation de mot de passe</h1>
          </div>
          <div class="content">
            <p>Bonjour ${data.userName},</p>
            <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
            <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>

            <a href="${data.resetLink}" class="button">Réinitialiser mon mot de passe</a>

            <div class="warning">
              <strong>⚠️ Attention :</strong> Ce lien expire dans ${data.expirationTime}.
            </div>

            <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
          </div>
          <div class="footer">
            <p>Pour votre sécurité, ne partagez jamais ce lien.</p>
          </div>
        </div>
      </body>
    </html>
  `,
  text: (data) => `
Réinitialisation de mot de passe

Bonjour ${data.userName},

Vous avez demandé la réinitialisation de votre mot de passe.

Cliquez sur le lien ci-dessous pour créer un nouveau mot de passe :
${data.resetLink}

⚠️ Attention : Ce lien expire dans ${data.expirationTime}.

Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.

Pour votre sécurité, ne partagez jamais ce lien.
  `.trim(),
}

/**
 * Données pour le template de bienvenue
 */
export interface WelcomeData {
  userName: string
  dashboardLink: string
}

/**
 * Template de bienvenue
 */
export const welcomeTemplate: EmailTemplate<WelcomeData> = {
  name: 'welcome',
  subject: (data) => `Bienvenue ${data.userName} !`,
  html: (data) => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background: #4CAF50; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .features { margin: 20px 0; }
          .feature { padding: 10px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Bienvenue !</h1>
          </div>
          <div class="content">
            <p>Bonjour ${data.userName},</p>
            <p>Nous sommes ravis de vous accueillir !</p>

            <p>Votre compte a été créé avec succès. Vous pouvez maintenant accéder à toutes les fonctionnalités :</p>

            <div class="features">
              <div class="feature">✅ Gestion de vos commandes</div>
              <div class="feature">✅ Suivi en temps réel</div>
              <div class="feature">✅ Tableau de bord personnalisé</div>
              <div class="feature">✅ Support client dédié</div>
            </div>

            <a href="${data.dashboardLink}" class="button">Accéder au tableau de bord</a>
          </div>
          <div class="footer">
            <p>Besoin d'aide ? Contactez notre support.</p>
          </div>
        </div>
      </body>
    </html>
  `,
  text: (data) => `
Bienvenue !

Bonjour ${data.userName},

Nous sommes ravis de vous accueillir !

Votre compte a été créé avec succès. Vous pouvez maintenant accéder à toutes les fonctionnalités :

✅ Gestion de vos commandes
✅ Suivi en temps réel
✅ Tableau de bord personnalisé
✅ Support client dédié

Accédez au tableau de bord : ${data.dashboardLink}

Besoin d'aide ? Contactez notre support.
  `.trim(),
}

/**
 * Données pour le template de prix gagné
 */
export interface PrizeWonData {
  prizeName: string
  redemptionCode: string
  expirationDate: string
  customerName: string
  storeName: string
}

/**
 * Template de prix gagné
 */
export const prizeWonTemplate: EmailTemplate<PrizeWonData> = {
  name: 'prizeWon',
  subject: (data) => `Félicitations ! Vous avez gagné : ${data.prizeName}`,
  html: (data) => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 30px; background: #f9f9f9; }
          .prize { background: white; padding: 24px; margin: 20px 0; text-align: center; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          .code-box { margin: 24px 0; padding: 24px; background: white; text-align: center; border-radius: 8px; border: 2px dashed #667eea; }
          .code { font-family: monospace; font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 4px; }
          .instructions { background: #e8f5e9; padding: 16px; border-radius: 8px; margin: 20px 0; }
          .expiration { background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; border-radius: 0 4px 4px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; border-radius: 0 0 8px 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Félicitations !</h1>
            <p style="margin: 0; opacity: 0.9;">Vous avez gagné chez ${data.storeName}</p>
          </div>
          <div class="content">
            <p>Bonjour ${data.customerName},</p>
            <p>Vous avez gagné un prix en jouant à la roue de la fortune !</p>

            <div class="prize">
              <h2 style="color: #667eea; margin: 0;">${data.prizeName}</h2>
            </div>

            <p style="text-align: center; font-weight: bold;">Votre code de rédemption :</p>

            <div class="code-box">
              <div class="code">${data.redemptionCode}</div>
            </div>

            <div class="instructions">
              <strong>Comment récupérer votre prix :</strong>
              <ol style="margin: 8px 0 0 0; padding-left: 20px;">
                <li>Rendez-vous chez ${data.storeName}</li>
                <li>Montrez ce code au personnel</li>
                <li>Profitez de votre prix !</li>
              </ol>
            </div>

            <div class="expiration">
              <strong>Validité :</strong> Ce prix est valable jusqu'au ${data.expirationDate}.
            </div>
          </div>
          <div class="footer">
            <p>${data.storeName} - À très bientôt !</p>
          </div>
        </div>
      </body>
    </html>
  `,
  text: (data) => `
Félicitations !

Bonjour ${data.customerName},

Vous avez gagné un prix en jouant à la roue de la fortune chez ${data.storeName} !

Prix gagné : ${data.prizeName}

Votre code de rédemption : ${data.redemptionCode}

Comment récupérer votre prix :
1. Rendez-vous chez ${data.storeName}
2. Montrez ce code au personnel
3. Profitez de votre prix !

Validité : Ce prix est valable jusqu'au ${data.expirationDate}.

${data.storeName} - À très bientôt !
  `.trim(),
}

/**
 * Map de tous les templates disponibles
 */
export const sesEmailTemplates = {
  orderConfirmation: orderConfirmationTemplate,
  passwordReset: passwordResetTemplate,
  welcome: welcomeTemplate,
  prizeWon: prizeWonTemplate,
} as const

/**
 * Type pour les noms de templates disponibles
 */
export type TemplateName = keyof typeof sesEmailTemplates

/**
 * Récupère un template par son nom
 */
export function getTemplate<T extends TemplateName>(
  name: T
): (typeof sesEmailTemplates)[T] {
  const template = sesEmailTemplates[name]
  if (!template) {
    throw new Error(`Template "${name}" introuvable`)
  }
  return template
}
