import { groq } from "next-sanity";

/**
 * GROQ queries centralisées. Chaque query est typée côté caller.
 *
 * Convention : on coallesce explicitement avec ?? null côté projection
 * pour avoir des objets stables côté TS.
 */

export const siteSettingsQuery = groq`*[_type == "siteSettings"][0]{
  navItems[]{
    label,
    href
  },
  ctaLabel,
  ctaHref,
  footer{
    columns[]{
      title,
      links[]{
        label,
        href
      }
    },
    copyright,
    signature,
    wordmarkText,
    contactEmail,
    location
  }
}`;

export const homePageQuery = groq`*[_type == "homePage"][0]{
  hero{
    eyebrow,
    titlePrefix,
    titleGradient,
    description,
    ctaPrimaryLabel,
    ctaPrimaryHref,
    ctaSecondaryLabel,
    ctaSecondaryHref
  },
  manifesto{
    eyebrow,
    line1,
    line1Accent,
    line2,
    line2Accent,
    line3,
    line3Accent,
    paragraph
  },
  approach{
    eyebrow,
    title,
    titleAccent,
    paragraphs
  },
  process{
    eyebrow,
    titleLine1,
    titleLine2,
    steps[]{
      num,
      tag,
      title,
      body
    }
  },
  selectedWork{
    eyebrow,
    titleLine1,
    titleLine2,
    viewAllLabel,
    viewAllHref
  },
  numbers{
    eyebrow,
    titleLine1,
    titleLine2,
    stats[]{
      value,
      prefix,
      suffix,
      label,
      caption
    }
  },
  products{
    eyebrow,
    titleLine1,
    titleLine2,
    intro
  },
  cta{
    eyebrow,
    titleLine1,
    titleLine2,
    paragraph,
    buttonLabel,
    buttonHref,
    fallbackLine
  }
}`;

export const allCaseStudiesQuery = groq`*[_type == "caseStudy"] | order(order asc){
  "slug": slug.current,
  client,
  category,
  year,
  title,
  blurb,
  cover,
  liveUrl,
  services,
  size,
  order,
  isStudioVenture,
  studioStatus
}`;

export const caseStudyBySlugQuery = groq`*[_type == "caseStudy" && slug.current == $slug][0]{
  "slug": slug.current,
  client,
  category,
  year,
  title,
  blurb,
  cover,
  liveUrl,
  services,
  size,
  order,
  isStudioVenture,
  studioStatus,
  body
}`;

export const caseStudySlugsQuery = groq`*[_type == "caseStudy" && defined(slug.current)][].slug.current`;

export const featuredProductQuery = groq`*[_type == "caseStudy" && slug.current == "be-in-digital-restaurant"][0]{
  "slug": slug.current,
  client,
  category,
  year,
  title,
  blurb,
  cover,
  liveUrl
}`;

export const studioVenturesQuery = groq`*[_type == "caseStudy" && isStudioVenture == true && slug.current != "be-in-digital-restaurant"] | order(order asc){
  "slug": slug.current,
  title,
  category,
  year,
  studioStatus,
  blurb,
  cover,
  liveUrl
}`;

export const aboutPageQuery = groq`*[_type == "aboutPage"][0]{
  hero{ eyebrow, titleLine1, titleLine2, intro, coverCaseStudySlug },
  manifesto{ eyebrow, titleLine1, titleLine2, paragraphs },
  recentWork{ eyebrow, titleLine1, titleLine2, viewAllLabel, viewAllHref },
  team{
    eyebrow,
    titleLine1,
    titleLine2,
    members[]{ role, title, body }
  },
  cta{ eyebrow, title, paragraph, buttonLabel, buttonHref }
}`;

export const productsPageQuery = groq`*[_type == "productsPage"][0]{
  hero{ eyebrow, titleLine1, titleLine2, intro },
  ventures{ eyebrow, titleLine1, titleLine2 },
  roadmap{
    eyebrow,
    titleLine1,
    titleLine2,
    items[]{ status, eta, category, title, body }
  },
  cta{ eyebrow, titleLine1, titleLine2, buttonLabel, buttonHref }
}`;

export const contactPageQuery = groq`*[_type == "contactPage"][0]{
  hero{ eyebrow, titleLine1, titleLine2, intro },
  sidebar{
    fastChannelsTitle,
    channels[]{ label, value, href },
    locationTitle,
    locationValue
  },
  form{ title, submitLabel, successMessage }
}`;

export const legalPageBySlugQuery = groq`*[_type == "legalPage" && slug.current == $slug][0]{
  title,
  "slug": slug.current,
  eyebrow,
  intro,
  lastUpdated,
  body
}`;

export const caseStudyCoverBySlugQuery = groq`*[_type == "caseStudy" && slug.current == $slug][0]{
  "slug": slug.current,
  title,
  cover
}`;
