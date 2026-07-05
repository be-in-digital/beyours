/**
 * Types TS générés à la main pour les documents Sanity. À terme on
 * utilisera `sanity-codegen` ou `@sanity/codegen` pour les générer
 * automatiquement depuis le schema. Pour l'instant on les écrit en
 * miroir des schemas + queries.
 */
import type { TypedObject } from "@portabletext/types";
import type { SanityImageSource } from "@sanity/image-url";

export type SanityImage = {
  _type: "image";
  asset: { _ref: string; _type: "reference" };
  alt?: string;
} & SanityImageSource;

export type NavItem = {
  label: string;
  href: string;
};

export type FooterColumn = {
  title: string;
  links: { label: string; href: string }[];
};

export type SiteSettings = {
  navItems: NavItem[];
  ctaLabel: string;
  ctaHref: string;
  footer: {
    wordmarkText: string;
    columns: FooterColumn[];
    copyright: string;
    signature: string;
    contactEmail: string;
    location: string;
  };
};

export type CaseStudySummary = {
  slug: string;
  client: string;
  category: string;
  year: string;
  title: string;
  blurb: string;
  cover: SanityImage;
  liveUrl?: string;
  services?: string[];
  size?: "sm" | "md" | "lg";
  order?: number;
  isStudioVenture?: boolean;
  studioStatus?: string;
};

export type CaseStudyDetail = CaseStudySummary & {
  body: TypedObject[];
};

export type StatItem = {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
  caption: string;
};

export type ProcessStep = {
  num: string;
  tag: string;
  title: string;
  body: string;
};

export type AboutPage = {
  hero: {
    eyebrow: string;
    titleLine1: string;
    titleLine2: string;
    intro: string;
    coverCaseStudySlug?: string;
  };
  manifesto: {
    eyebrow: string;
    titleLine1: string;
    titleLine2: string;
    paragraphs: TypedObject[];
  };
  recentWork: {
    eyebrow: string;
    titleLine1: string;
    titleLine2: string;
    viewAllLabel: string;
    viewAllHref: string;
  };
  team: {
    eyebrow: string;
    titleLine1: string;
    titleLine2: string;
    members: { role: string; title: string; body: string }[];
  };
  cta: {
    eyebrow: string;
    title: string;
    paragraph: string;
    buttonLabel: string;
    buttonHref: string;
  };
};

export type ProductsPage = {
  hero: {
    eyebrow: string;
    titleLine1: string;
    titleLine2: string;
    intro: string;
  };
  ventures: {
    eyebrow: string;
    titleLine1: string;
    titleLine2: string;
  };
  roadmap: {
    eyebrow: string;
    titleLine1: string;
    titleLine2: string;
    items: {
      status: string;
      eta: string;
      category: string;
      title: string;
      body: string;
    }[];
  };
  cta: {
    eyebrow: string;
    titleLine1: string;
    titleLine2: string;
    buttonLabel: string;
    buttonHref: string;
  };
};

export type ContactPage = {
  hero: {
    eyebrow: string;
    titleLine1: string;
    titleLine2: string;
    intro: string;
  };
  sidebar: {
    fastChannelsTitle: string;
    channels: { label: string; value: string; href: string }[];
    locationTitle: string;
    locationValue: string;
  };
  form: {
    title: string;
    submitLabel: string;
    successMessage: string;
  };
};

export type LegalPage = {
  title: string;
  slug: string;
  eyebrow: string;
  intro?: string;
  lastUpdated?: string;
  body: TypedObject[];
};

export type HomePage = {
  hero: {
    eyebrow: string;
    titlePrefix: string;
    titleGradient: string;
    description: TypedObject[];
    ctaPrimaryLabel: string;
    ctaPrimaryHref: string;
    ctaSecondaryLabel: string;
    ctaSecondaryHref: string;
  };
  manifesto: {
    eyebrow: string;
    line1: string;
    line1Accent: string;
    line2: string;
    line2Accent: string;
    line3: string;
    line3Accent: string;
    paragraph: string;
  };
  approach: {
    eyebrow: string;
    title: string;
    titleAccent: string;
    paragraphs: TypedObject[];
  };
  process: {
    eyebrow: string;
    titleLine1: string;
    titleLine2: string;
    steps: ProcessStep[];
  };
  selectedWork: {
    eyebrow: string;
    titleLine1: string;
    titleLine2: string;
    viewAllLabel: string;
    viewAllHref: string;
  };
  numbers: {
    eyebrow: string;
    titleLine1: string;
    titleLine2: string;
    stats: StatItem[];
  };
  products: {
    eyebrow: string;
    titleLine1: string;
    titleLine2: string;
    intro: string;
  };
  cta: {
    eyebrow: string;
    titleLine1: string;
    titleLine2: string;
    paragraph: string;
    buttonLabel: string;
    buttonHref: string;
    fallbackLine: string;
  };
};
