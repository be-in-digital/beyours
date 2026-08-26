/**
 * Source of truth — the publisher's legal information.
 *
 * The company trades as **Be in Digital** (the agency) and sells **BeYours**
 * (the product). Its registered name at the RCS is **TUUM AGENCY**, a SAS.
 * Prose uses `operatorName`; the dénomination sociale `legalName` stays
 * wherever the law requires it: invoice footer and legal notice. Every legal page, invoice and
 * email must reference this information FROM this file — never hard-code a
 * duplicate elsewhere.
 *
 * Fields set to `null` are information the company director has not provided
 * yet: the pages render them through the <Todo/> marker so that no value is
 * ever invented (project rule: fabricate nothing).
 *
 * VAT regime: régime réel, 20 %. See the VAT block below.
 *
 * Data confirmed by the INSEE / RNE (INPI) extract dated 19/07/2026.
 */

export interface CompanyInfo {
  /** Registered company name (legal entity). */
  legalName: string;
  /** Commercial brand / name of the product being operated. */
  tradeName: string;
  /** Name the company trades under and leads with on documents. Prose says
   *  « Be in Digital »; the registered `legalName` still appears wherever the
   *  law requires the dénomination sociale (invoice footer, legal notice). */
  operatorName: string;
  /** Legal form. */
  legalForm: string;
  /** Share capital in euros. `null` until the director provides it. */
  capitalEuros: number | null;
  siren: string;
  siret: string;
  /** Trade and companies register (RCS) + city of the registry. */
  rcs: string;
  apeCode: string;
  apeLabel: string;
  /** Intra-EU VAT number (assigned even under the franchise en base regime). */
  vatNumber: string;
  address: {
    street: string;
    postalCode: string;
    city: string;
    country: string;
  };
  /** President / legal representative. `null` until the director provides it. */
  legalRepresentative: string | null;
  email: string;
  phone: string | null;
  /** Date of registration with the RNE (INPI). */
  registeredAt: string;
}

export const COMPANY: CompanyInfo = {
  legalName: "TUUM AGENCY",
  tradeName: "BeYours",
  operatorName: "Be in Digital",
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
  email: "hello@beyours.fr",
  phone: null,
  registeredAt: "10 juillet 2024",
};

/**
 * The VAT regime in force. The company operates on the régime réel: VAT is
 * charged at the standard rate, and the matching legal mention is read from
 * `VAT.mention` by the terms of sale (`app/(landing)/cgv/page.tsx`) and the
 * legal notice (`app/(landing)/mentions-legales/page.tsx`), so both realign on
 * their own.
 *
 * The mention here is the customer-facing one. The Stripe invoice carries the
 * intra-EU VAT number through `vatMention()` in `convex/invoiceLegal.ts`, which
 * is what an invoice legally needs under this regime — the old 293 B franchise
 * mention must NOT be added there. That function follows `regime` below, so the
 * two can no longer contradict each other.
 *
 * Two flags gate the actual charging, and they go together: display and
 * checkout totals follow `NEXT_PUBLIC_TVA_ENABLED` (Next side, see
 * `lib/payment-providers.ts`), Stripe follows `STRIPE_TAX_ENABLED` (Convex
 * side, see `convex/stripe.ts`). Setting one without the other means the site
 * quotes a total it does not collect, or the reverse.
 *
 * Every price in the app is quoted excluding tax, which is the right B2B
 * convention here — restaurants recover the VAT. Switching regime therefore
 * changes what the checkout adds, never the catalogue figures. Rate and
 * wording still have to be validated by an accountant.
 */
export const VAT = {
  regime: "reel" as "franchise" | "reel",
  mention: "TVA applicable au taux de 20 % (art. 278 du CGI)",
} as const;

/**
 * Late payment terms between professionals — mandatory BOTH in the terms of
 * sale and on the invoice (art. L441-9 and L441-10 of the commercial code).
 *
 * These are the statutory defaults, which is precisely what applies when the
 * terms of sale agree nothing else — so stating them invents no commercial
 * term. Three times the legal interest rate is the usual alternative; picking
 * it is a commercial decision, and it changes the CGV and the invoice together
 * from here.
 *
 * Read by `app/(landing)/cgv/page.tsx` and by `convex/invoiceLegal.ts`.
 * Consumers are outside this: these terms bind professionals only.
 */
export const LATE_PAYMENT = {
  /** Basis of the penalty rate, worded as the law words it. */
  penaltyRate:
    "taux d'intérêt appliqué par la Banque centrale européenne à son opération de refinancement la plus récente, majoré de 10 points de pourcentage",
  /** Flat indemnity for recovery costs (art. D. 441-5). */
  indemnityEuros: 40,
  /** Early payment discount granted. None, and an invoice must say so. */
  earlyPaymentDiscount: null as string | null,
} as const;

export interface HostingProvider {
  name: string;
  address: string;
  url: string;
}

/**
 * Hosting — required in the legal notice by the LCEN (art. 6-III).
 * The application backend and the database are operated by Convex (certain,
 * see the stack). The frontend host is not pinned down in the repository:
 * confirm it against the actual deployment (probably Vercel) before going live.
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
 * Consumer mediator — mandatory as soon as a consumer can buy, meaning any
 * `buyerType: "personal"` purchase. To be subscribed to, then filled in here.
 */
export const CONSUMER_MEDIATOR: { name: string; url: string } | null = null; // [TO BE COMPLETED]

/** Date the legal documents were last revised (static, edited by hand). */
export const LEGAL_LAST_UPDATED = "19 juillet 2026";

/** Sub-processors / third-party services handling data (GDPR). */
export const SUBPROCESSORS: { name: string; role: string; location: string }[] = [
  { name: "Convex, Inc.", role: "Hébergement applicatif et base de données", location: "États-Unis" },
  { name: "Stripe Payments Europe, Ltd.", role: "Traitement des paiements", location: "Irlande / États-Unis" },
  { name: "Amazon Web Services (AWS SES)", role: "Envoi des emails transactionnels", location: "Union européenne" },
  { name: "Vercel Inc.", role: "Hébergement du site", location: "États-Unis / Union européenne" },
];
