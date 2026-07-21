/**
 * Source de vérité — informations légales de l'éditeur.
 *
 * L'entité juridique qui édite et exploite la marque commerciale « Be in
 * Digital » est **TUUM AGENCY**, SAS. Toutes les pages légales, la facturation
 * et les emails doivent référencer ces informations DEPUIS ce fichier — ne
 * jamais les dupliquer en dur ailleurs.
 *
 * Les champs à `null` correspondent à une information non encore communiquée
 * par le dirigeant : les pages les rendent via le marqueur <Todo/> afin
 * qu'aucune valeur ne soit inventée (règle projet : ne rien fabriquer).
 *
 * Régime TVA : franchise en base (art. 293 B du CGI), cohérent avec l'affichage
 * du checkout (`components/checkout/order-summary.tsx`) et les flags Stripe Tax
 * OFF (`convex/stripe.ts`). Le jour de l'assujettissement : passer
 * `VAT.regime` à "reel" et flipper les flags.
 *
 * Données confirmées par l'extrait INSEE / RNE (INPI) du 19/07/2026.
 */

export interface CompanyInfo {
  /** Raison sociale (entité juridique). */
  legalName: string;
  /** Marque commerciale / nom du produit exploité. */
  tradeName: string;
  /** Forme juridique. */
  legalForm: string;
  /** Capital social en euros. `null` tant que non communiqué. */
  capitalEuros: number | null;
  siren: string;
  siret: string;
  /** Registre du commerce et des sociétés + ville du greffe. */
  rcs: string;
  apeCode: string;
  apeLabel: string;
  /** N° TVA intracommunautaire (attribué même en franchise en base). */
  vatNumber: string;
  address: {
    street: string;
    postalCode: string;
    city: string;
    country: string;
  };
  /** Président / représentant légal. `null` tant que non communiqué. */
  legalRepresentative: string | null;
  email: string;
  phone: string | null;
  /** Date d'immatriculation au RNE (INPI). */
  registeredAt: string;
}

export const COMPANY: CompanyInfo = {
  legalName: "TUUM AGENCY",
  tradeName: "Be in Digital",
  legalForm: "SAS (société par actions simplifiée)",
  capitalEuros: 1000,
  siren: "930 817 697",
  siret: "930 817 697 00012",
  rcs: "R.C.S. Paris 930 817 697",
  apeCode: "62.01Z",
  apeLabel: "Programmation informatique",
  vatNumber: "FR31 930 817 697",
  address: {
    street: "229 rue Saint-Honoré",
    postalCode: "75001",
    city: "Paris",
    country: "France",
  },
  legalRepresentative: "Fatiha ELKARROUTI",
  email: "hello@beindigital.fr",
  phone: null,
  registeredAt: "10 juillet 2024",
};

/**
 * Régime de TVA appliqué. En franchise en base, aucune TVA n'est facturée et
 * la mention légale correspondante figure sur les factures et le checkout.
 */
export const VAT = {
  regime: "reel" as "franchise" | "reel",
  mention: "TVA applicable au taux en vigueur (20 %)",
} as const;

export interface HostingProvider {
  name: string;
  address: string;
  url: string;
}

/**
 * Hébergement — requis par la LCEN (art. 6-III) dans les mentions légales.
 * Le backend applicatif et la base de données sont opérés par Convex (certain,
 * cf. stack). L'hébergeur du frontend n'est pas figé dans le dépôt : à
 * confirmer selon le déploiement réel (probablement Vercel) avant mise en ligne.
 */
export const HOSTING: {
  frontend: HostingProvider | null;
  backend: HostingProvider;
} = {
  frontend: {
    name: "Vercel Inc.",
    address: "440 N Barranca Ave #4133, Covina, CA 91723, États-Unis",
    url: "https://vercel.com",
  },
  backend: {
    name: "Convex, Inc.",
    address: "San Francisco, Californie, États-Unis",
    url: "https://www.convex.dev",
  },
};

/**
 * Médiateur de la consommation — obligatoire dès lors qu'un consommateur
 * (achat `buyerType: "personal"`) peut acheter. À souscrire puis renseigner.
 */
export const CONSUMER_MEDIATOR: { name: string; url: string } | null = null; // [À COMPLÉTER]

/** Date de dernière révision des documents légaux (statique, éditée à la main). */
export const LEGAL_LAST_UPDATED = "19 juillet 2026";

/** Sous-traitants / services tiers traitant des données (RGPD). */
export const SUBPROCESSORS: { name: string; role: string; location: string }[] = [
  { name: "Convex, Inc.", role: "Hébergement applicatif et base de données", location: "États-Unis" },
  { name: "Stripe Payments Europe, Ltd.", role: "Traitement des paiements", location: "Irlande / États-Unis" },
  { name: "Amazon Web Services (AWS SES)", role: "Envoi des emails transactionnels", location: "Union européenne" },
  { name: "Vercel Inc.", role: "Hébergement du site", location: "États-Unis / Union européenne" },
];
