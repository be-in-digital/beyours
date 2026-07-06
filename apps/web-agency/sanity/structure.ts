import type { StructureResolver } from "sanity/structure";

const SINGLETONS: Array<{ id: string; title: string; type: string }> = [
  { id: "siteSettings", title: "Réglages globaux", type: "siteSettings" },
  { id: "homePage", title: "Page d'accueil", type: "homePage" },
  { id: "aboutPage", title: "Page À propos", type: "aboutPage" },
  { id: "productsPage", title: "Page Produits", type: "productsPage" },
  { id: "contactPage", title: "Page Contact", type: "contactPage" },
];

export const structure: StructureResolver = (S) =>
  S.list()
    .title("Be in Digital — Contenu")
    .items([
      ...SINGLETONS.map((s) =>
        S.listItem()
          .title(s.title)
          .id(s.id)
          .child(
            S.editor().id(s.id).schemaType(s.type).documentId(s.id),
          ),
      ),
      S.divider(),
      S.documentTypeListItem("caseStudy").title("Études de cas"),
      S.documentTypeListItem("legalPage").title("Pages légales"),
    ]);
