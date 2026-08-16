/**
 * Source of truth — the publisher's legal information.
 *
 * The legal entity that publishes and operates the « Be in Digital »
 * commercial brand is **TUUM AGENCY**, a SAS. Every legal page, invoice and
 * email must reference this information FROM this file — never hard-code a
 * duplicate elsewhere.
 *
 * Fields set to `null` are information the company director has not provided
 * yet: the pages render them through the <Todo/> marker so that no value is
 * ever invented (project rule: fabricate nothing).
 *
 * VAT regime: franchise en base (art. 293 B of the French tax code). No VAT is
 * charged (the payment engine bills 0 € of tax) and the mention rendered
 * everywhere is « TVA non applicable, art. 293 B du CGI ». Consistent with the
 * checkout display (`components/checkout/order-summary.tsx`, `TVA_ENABLED`
 * off) and the Stripe Tax flags being OFF (`convex/stripe.ts`). The day the
 * company becomes VAT-liable (régime réel): set `VAT.regime` to "reel",
 * `VAT.mention` to the applicable rate and flip both flags
 * (`NEXT_PUBLIC_TVA_ENABLED` + `STRIPE_TAX_ENABLED`).
 *
 * Data confirmed by the INSEE / RNE (INPI) extract dated 19/07/2026.
 */

export interface CompanyInfo {
  /** Registered company name (legal entity). */
  legalName: string;
  /** Commercial brand / name of the product being operated. */
  tradeName: string;
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
 * The VAT regime in force. Under franchise en base (art. 293 B of the French
 * tax code) no VAT is charged, and the matching legal mention is read from
 * `VAT.mention` by the terms of sale (`app/(landing)/cgv/page.tsx`) and the
 * legal notice (`app/(landing)/mentions-legales/page.tsx`), so both realign on
 * their own.
 *
 * NB — invoice footer: the 293 B mention must ALSO appear on the Stripe
 * invoice. The `SELLER_INVOICE_FOOTER` footer lives in `convex/stripe.ts`
 * (outside this file's scope) and does not carry it yet: complete it there.
 *
 * Guardrail: the franchise en base for services has a ceiling (~37 500 € of
 * revenue / ~41 250 € tolerance in 2026). Watch cumulative revenue — a single
 * ticket (one Création worth several thousand €) can cross it → switching to
 * the régime réel becomes mandatory, retroactive to the 1st of the month the
 * threshold was crossed. To be confirmed by an accountant. These thresholds
 * and mentions are proposals and must be validated by counsel (accountant /
 * lawyer) before going live.
 */
export const VAT = {
  regime: "franchise" as "franchise" | "reel",
  mention: "TVA non applicable, art. 293 B du CGI",
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
