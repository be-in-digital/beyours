import type { FieldInfoProps } from "./settings-types"

// ---------------------------------------------------------------------------
// Help content for each integration field
// ---------------------------------------------------------------------------

export const HELP = {
  uberDirect: {
    customerId: {
      title: "Customer ID (Uber Store ID)",
      description: "Identifiant unique de votre restaurant sur Uber Direct.",
      steps: [
        { text: "Connectez-vous au tableau de bord Uber Direct." },
        { text: "Allez dans Paramètres > API." },
        { text: "Copiez le Customer ID (aussi appelé Store ID) affiché dans la section identifiants." },
      ],
      links: [
        { label: "Uber Direct Dashboard", url: "https://dashboard.uber.com/" },
      ],
    } satisfies FieldInfoProps,
    clientId: {
      title: "Client ID (OAuth)",
      description: "Clé d'identification de votre application Uber pour l'authentification API.",
      steps: [
        { text: "Rendez-vous sur le portail développeur Uber." },
        { text: "Créez une application ou sélectionnez une application existante." },
        { text: "Dans l'onglet « Credentials », copiez le Client ID." },
      ],
      links: [
        { label: "Uber Developer Portal", url: "https://developer.uber.com/" },
        { label: "Documentation API Uber Direct", url: "https://developer.uber.com/docs/deliveries/overview" },
      ],
    } satisfies FieldInfoProps,
    clientSecret: {
      title: "Client Secret (OAuth)",
      description: "Clé secrète liée à votre application Uber. Ne la partagez jamais.",
      steps: [
        { text: "Rendez-vous sur le portail développeur Uber." },
        { text: "Sélectionnez votre application." },
        { text: "Dans l'onglet « Credentials », copiez le Client Secret." },
      ],
      links: [
        { label: "Uber Developer Portal", url: "https://developer.uber.com/" },
      ],
      note: "Le Client Secret n'est visible qu'une seule fois lors de sa création. Si vous l'avez perdu, vous devez en générer un nouveau.",
    } satisfies FieldInfoProps,
  },
  uberEats: {
    general: {
      title: "Uber Eats",
      description: "Intégration pour synchroniser votre menu et recevoir des commandes Uber Eats.",
      steps: [
        { text: "Créez un compte restaurant sur Uber Eats si ce n'est pas déjà fait." },
        { text: "Contactez votre account manager Uber Eats pour activer l'accès API." },
        { text: "Une fois l'API activée par Uber, activez l'intégration ici." },
      ],
      links: [
        { label: "Uber Eats for Merchants", url: "https://merchants.ubereats.com/" },
        { label: "Uber Eats API Documentation", url: "https://developer.uber.com/docs/eats/introduction" },
      ],
      note: "L'activation de l'API Uber Eats nécessite un accord préalable avec Uber. Contactez votre représentant commercial.",
    } satisfies FieldInfoProps,
  },
  deliveroo: {
    general: {
      title: "Deliveroo",
      description: "Intégration pour synchroniser votre menu et recevoir des commandes Deliveroo.",
      steps: [
        { text: "Créez un compte restaurant partenaire sur Deliveroo si ce n'est pas déjà fait." },
        { text: "Contactez votre account manager Deliveroo pour demander l'accès API." },
        { text: "Deliveroo vous fournira vos identifiants d'intégration." },
        { text: "Une fois les identifiants reçus, activez l'intégration ici." },
      ],
      links: [
        { label: "Deliveroo for Restaurants", url: "https://restaurants.deliveroo.com/" },
        { label: "Deliveroo API Documentation", url: "https://developers.deliveroo.com/" },
      ],
      note: "L'accès API Deliveroo est réservé aux restaurants partenaires. Contactez votre représentant pour démarrer l'intégration.",
    } satisfies FieldInfoProps,
  },
  payments: {
    stripe: {
      title: "Stripe",
      description: "Plateforme de paiement en ligne et terminal de paiement.",
      steps: [
        { text: "Cliquez sur le bouton « Connecter » ci-dessous." },
        { text: "Vous serez redirigé vers Stripe pour créer ou connecter votre compte." },
        { text: "Complétez les informations demandées par Stripe (identité, coordonnées bancaires)." },
        { text: "Une fois terminé, vous serez automatiquement redirigé ici." },
      ],
      links: [
        { label: "Stripe Dashboard", url: "https://dashboard.stripe.com/" },
        { label: "Tarifs Stripe", url: "https://stripe.com/fr/pricing" },
      ],
    } satisfies FieldInfoProps,
    sumup: {
      title: "SumUp",
      description: "Terminal de paiement mobile pour les paiements en personne.",
      steps: [
        { text: "Cliquez sur le bouton « Connecter » ci-dessous." },
        { text: "Connectez-vous à votre compte SumUp ou créez-en un." },
        { text: "Autorisez l'accès à votre compte SumUp." },
        { text: "Vous serez automatiquement redirigé ici une fois connecté." },
      ],
      links: [
        { label: "SumUp Dashboard", url: "https://me.sumup.com/" },
        { label: "Boutique SumUp (terminaux)", url: "https://store.sumup.com/" },
      ],
    } satisfies FieldInfoProps,
    paypal: {
      title: "PayPal",
      description: "Accepter les paiements via PayPal en renseignant votre adresse email PayPal Business.",
      steps: [
        { text: "Créez ou connectez-vous à votre compte PayPal Business." },
        { text: "Copiez l'adresse email associée à votre compte PayPal Business." },
        { text: "Collez-la dans le champ ci-dessous et enregistrez." },
      ],
      links: [
        { label: "PayPal Business", url: "https://www.paypal.com/business" },
        { label: "Tarifs PayPal", url: "https://www.paypal.com/fr/webapps/mpp/merchant-fees" },
      ],
    } satisfies FieldInfoProps,
  },
}
