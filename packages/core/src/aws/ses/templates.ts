/**
 * Email templates for SES
 * @module aws/ses/templates
 */

/**
 * Generic interface for an email template
 */
export interface EmailTemplate<T = Record<string, unknown>> {
  /** Template name */
  name: string
  /** Builds the subject line */
  subject: (data: T) => string
  /** Builds the HTML body */
  html: (data: T) => string
  /** Builds the plain text body */
  text: (data: T) => string
}

/**
 * Data for the order confirmation template
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
 * Order confirmation template
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
 * Data for the password reset template
 */
export interface SESPasswordResetData {
  resetLink: string
  expirationTime: string
  userName: string
}

/**
 * Password reset template
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
 * Data for the welcome template
 */
export interface WelcomeData {
  userName: string
  dashboardLink: string
}

/**
 * Welcome template
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
 * Data for the prize won template
 */
export interface PrizeWonData {
  prizeName: string
  qrCode: string
  expirationDate: string
  customerName: string
}

/**
 * Prize won template
 */
export const prizeWonTemplate: EmailTemplate<PrizeWonData> = {
  name: 'prizeWon',
  subject: (data) => `🎉 Félicitations ! Vous avez gagné : ${data.prizeName}`,
  html: (data) => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .prize { background: white; padding: 20px; margin: 20px 0; text-align: center; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          .qr-code { margin: 20px 0; padding: 20px; background: white; display: inline-block; border-radius: 8px; }
          .expiration { background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Félicitations !</h1>
          </div>
          <div class="content">
            <p>Bonjour ${data.customerName},</p>
            <p>Vous avez gagné un prix à notre jeu !</p>

            <div class="prize">
              <h2 style="color: #667eea; margin: 0;">${data.prizeName}</h2>
            </div>

            <p style="text-align: center;">Présentez ce QR code en restaurant pour récupérer votre prix :</p>

            <div style="text-align: center;">
              <div class="qr-code">
                <img src="${data.qrCode}" alt="QR Code" style="max-width: 200px;">
              </div>
            </div>

            <div class="expiration">
              <strong>⏰ Validité :</strong> Ce prix est valable jusqu'au ${data.expirationDate}.
            </div>

            <p style="text-align: center;">Nous avons hâte de vous voir !</p>
          </div>
          <div class="footer">
            <p>À très bientôt !</p>
          </div>
        </div>
      </body>
    </html>
  `,
  text: (data) => `
🎉 Félicitations !

Bonjour ${data.customerName},

Vous avez gagné un prix à notre jeu !

🏆 Prix gagné : ${data.prizeName}

Présentez votre QR code en restaurant pour récupérer votre prix.

⏰ Validité : Ce prix est valable jusqu'au ${data.expirationDate}.

Nous avons hâte de vous voir !

À très bientôt !
  `.trim(),
}

/**
 * Data for the email verification template
 */
export interface VerifyEmailData {
  verifyLink: string
  userName: string
}

/**
 * Email verification template
 *
 * Sent on sign-up, and again on any sign-in attempt made before the address is
 * confirmed. Without it `requireEmailVerification` mints a token nobody ever
 * receives, and the account can never be signed in to.
 */
export const verifyEmailTemplate: EmailTemplate<VerifyEmailData> = {
  name: 'verifyEmail',
  subject: () => 'Confirmez votre adresse email',
  html: (data) => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #0D5C3F; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background: #0D5C3F; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .fallback { word-break: break-all; font-size: 12px; color: #666; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Confirmez votre adresse</h1>
          </div>
          <div class="content">
            <p>Bonjour ${data.userName},</p>
            <p>Il reste une étape : confirmez cette adresse pour activer votre compte.</p>

            <a href="${data.verifyLink}" class="button">Confirmer mon adresse</a>

            <p class="fallback">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>${data.verifyLink}</p>

            <p>Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email.</p>
          </div>
          <div class="footer">
            <p>Ce lien est à usage unique.</p>
          </div>
        </div>
      </body>
    </html>
  `,
  text: (data) => `
Confirmez votre adresse email

Bonjour ${data.userName},

Il reste une étape : confirmez cette adresse pour activer votre compte.

${data.verifyLink}

Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email.

Ce lien est à usage unique.
  `.trim(),
}

/**
 * Map of every available template
 */
export const sesEmailTemplates = {
  orderConfirmation: orderConfirmationTemplate,
  passwordReset: passwordResetTemplate,
  verifyEmail: verifyEmailTemplate,
  welcome: welcomeTemplate,
  prizeWon: prizeWonTemplate,
} as const

/**
 * Union of the available template names
 */
export type TemplateName = keyof typeof sesEmailTemplates

/**
 * Looks up a template by name
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
