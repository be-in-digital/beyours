import type { SchemaTypeDefinition } from "sanity";

import { aboutPage } from "./aboutPage";
import { caseStudy } from "./caseStudy";
import { contactPage } from "./contactPage";
import { homePage } from "./homePage";
import { legalPage } from "./legalPage";
import { productsPage } from "./productsPage";
import { siteSettings } from "./siteSettings";

export const schemaTypes: SchemaTypeDefinition[] = [
  siteSettings,
  homePage,
  aboutPage,
  productsPage,
  contactPage,
  legalPage,
  caseStudy,
];
