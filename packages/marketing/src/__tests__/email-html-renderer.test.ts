import { describe, it, expect } from "vitest"
import {
  renderTextBlock,
  renderImageBlock,
  renderButtonBlock,
  renderProductBlock,
  renderDividerBlock,
  renderSpacerBlock,
  renderHeadingBlock,
  renderSocialBlock,
  renderCouponBlock,
  renderColumnsBlock,
  renderVideoBlock,
  renderHeroBlock,
  renderMenuHighlightBlock,
  renderCountdownBlock,
  renderGalleryBlock,
  renderLocationBlock,
  renderHoursBlock,
  renderTestimonialBlock,
  renderDecorativeDividerBlock,
  renderBlockToEmailHtml,
  renderTemplateToEmailHtml,
  type TextBlock,
  type ImageBlock,
  type ButtonBlock,
  type ProductBlock,
  type DividerBlock,
  type SpacerBlock,
  type HeadingBlock,
  type SocialBlock,
  type CouponBlock,
  type ColumnsBlock,
  type VideoBlock,
  type HeroBlock,
  type MenuHighlightBlock,
  type CountdownBlock,
  type GalleryBlock,
  type LocationBlock,
  type HoursBlock,
  type TestimonialBlock,
  type DecorativeDividerBlock,
  type EmailBranding,
  type ProductData,
} from "../email-html-renderer"

const branding: EmailBranding = {
  primaryColor: "#FF5722",
  secondaryColor: "#333333",
  senderName: "Pizza Express",
  unsubscribeUrl: "https://example.com/unsub",
  unsubscribeText: "Se désabonner",
}

describe("renderTextBlock", () => {
  it("devrait rendre un bloc texte avec le contenu", () => {
    const block: TextBlock = { type: "text", id: "t1", content: "Bonjour !" }
    const html = renderTextBlock(block)
    expect(html).toContain("Bonjour !")
    expect(html).toContain('align="left"')
  })

  it("devrait respecter l'alignement center", () => {
    const block: TextBlock = {
      type: "text",
      id: "t1",
      content: "Centré",
      alignment: "center",
    }
    const html = renderTextBlock(block)
    expect(html).toContain('align="center"')
  })
})

describe("renderImageBlock", () => {
  it("devrait rendre une image avec src et alt", () => {
    const block: ImageBlock = {
      type: "image",
      id: "i1",
      url: "https://cdn.test/img.jpg",
      alt: "Photo",
    }
    const html = renderImageBlock(block)
    expect(html).toContain('src="https://cdn.test/img.jpg"')
    expect(html).toContain('alt="Photo"')
  })

  it("devrait envelopper dans un lien si linkUrl est fourni", () => {
    const block: ImageBlock = {
      type: "image",
      id: "i1",
      url: "https://cdn.test/img.jpg",
      linkUrl: "https://example.com",
    }
    const html = renderImageBlock(block)
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain("<a ")
  })

  it("devrait utiliser width=600 par défaut", () => {
    const block: ImageBlock = {
      type: "image",
      id: "i1",
      url: "https://cdn.test/img.jpg",
    }
    const html = renderImageBlock(block)
    expect(html).toContain('width="600"')
  })
})

describe("renderButtonBlock", () => {
  it("devrait rendre un bouton avec texte et URL", () => {
    const block: ButtonBlock = {
      type: "button",
      id: "b1",
      text: "Commander",
      url: "https://shop.test",
    }
    const html = renderButtonBlock(block)
    expect(html).toContain("Commander")
    expect(html).toContain('href="https://shop.test"')
  })

  it("devrait appliquer les couleurs personnalisées", () => {
    const block: ButtonBlock = {
      type: "button",
      id: "b1",
      text: "Go",
      url: "#",
      backgroundColor: "#FF0000",
      textColor: "#00FF00",
    }
    const html = renderButtonBlock(block)
    expect(html).toContain("#FF0000")
    expect(html).toContain("#00FF00")
  })
})

describe("renderProductBlock", () => {
  const products: ProductData[] = [
    { id: "p1", name: "Pizza Margherita", price: 1200, imageUrl: "https://cdn.test/pizza.jpg" },
    { id: "p2", name: "Tiramisu", price: 800 },
  ]

  it("devrait rendre une liste de produits", () => {
    const block: ProductBlock = {
      type: "product",
      id: "pr1",
      productIds: ["p1", "p2"],
    }
    const html = renderProductBlock(block, products)
    expect(html).toContain("Pizza Margherita")
    expect(html).toContain("Tiramisu")
  })

  it("devrait rendre un grid avec 2+ produits", () => {
    const block: ProductBlock = {
      type: "product",
      id: "pr1",
      productIds: ["p1", "p2"],
      layout: "grid",
    }
    const html = renderProductBlock(block, products)
    expect(html).toContain('width="50%"')
  })

  it("devrait retourner une chaîne vide sans produits", () => {
    const block: ProductBlock = {
      type: "product",
      id: "pr1",
      productIds: [],
    }
    const html = renderProductBlock(block, [])
    expect(html).toBe("")
  })
})

describe("renderDividerBlock", () => {
  it("devrait rendre un séparateur avec couleur par défaut", () => {
    const block: DividerBlock = { type: "divider", id: "d1" }
    const html = renderDividerBlock(block)
    expect(html).toContain("#eeeeee")
    expect(html).toContain("1px solid")
  })

  it("devrait respecter les couleurs et épaisseurs personnalisées", () => {
    const block: DividerBlock = {
      type: "divider",
      id: "d1",
      color: "#FF0000",
      thickness: 3,
    }
    const html = renderDividerBlock(block)
    expect(html).toContain("3px solid #FF0000")
  })
})

describe("renderSpacerBlock", () => {
  it("devrait rendre un espacement de 24px par défaut", () => {
    const block: SpacerBlock = { type: "spacer", id: "s1" }
    const html = renderSpacerBlock(block)
    expect(html).toContain('height="24"')
  })

  it("devrait respecter une hauteur personnalisée", () => {
    const block: SpacerBlock = { type: "spacer", id: "s1", height: 48 }
    const html = renderSpacerBlock(block)
    expect(html).toContain('height="48"')
  })
})

describe("renderBlockToEmailHtml", () => {
  it("devrait dispatcher vers le bon renderer selon le type", () => {
    const text: TextBlock = { type: "text", id: "t1", content: "Hello" }
    expect(renderBlockToEmailHtml(text)).toContain("Hello")

    const spacer: SpacerBlock = { type: "spacer", id: "s1" }
    expect(renderBlockToEmailHtml(spacer)).toContain('height="24"')
  })

  it("devrait retourner une chaîne vide pour un type inconnu", () => {
    const unknown = { type: "unknown", id: "u1" } as any
    expect(renderBlockToEmailHtml(unknown)).toBe("")
  })
})

describe("renderTemplateToEmailHtml", () => {
  it("devrait générer un document HTML complet", () => {
    const blocks = [
      { type: "text" as const, id: "t1", content: "Bienvenue !" },
      { type: "spacer" as const, id: "s1", height: 16 },
    ]
    const html = renderTemplateToEmailHtml(blocks, branding)

    expect(html).toContain("<!DOCTYPE html>")
    expect(html).toContain("Bienvenue !")
    expect(html).toContain("Pizza Express")
    expect(html).toContain("Se désabonner")
    expect(html).toContain("https://example.com/unsub")
  })

  it("devrait inclure le logo si fourni", () => {
    const html = renderTemplateToEmailHtml(
      [],
      { ...branding, logoUrl: "https://cdn.test/logo.png" }
    )
    expect(html).toContain('src="https://cdn.test/logo.png"')
  })

  it("devrait inclure les liens sociaux", () => {
    const html = renderTemplateToEmailHtml(
      [],
      {
        ...branding,
        socialLinks: {
          facebook: "https://fb.me/test",
          instagram: "https://ig.com/test",
        },
      }
    )
    expect(html).toContain("https://fb.me/test")
    expect(html).toContain("https://ig.com/test")
  })

  it("devrait inclure le footerText si fourni", () => {
    const html = renderTemplateToEmailHtml(
      [],
      { ...branding, footerText: "Pizza Express SARL" }
    )
    expect(html).toContain("Pizza Express SARL")
  })
})

describe("renderHeadingBlock", () => {
  it("devrait rendre un titre H1 avec la bonne taille", () => {
    const block: HeadingBlock = {
      type: "heading",
      id: "h1",
      content: "Bienvenue !",
      level: "h1",
    }
    const html = renderHeadingBlock(block)
    expect(html).toContain("Bienvenue !")
    expect(html).toContain("font-size:28px")
    expect(html).toContain("font-weight:bold")
  })

  it("devrait rendre un titre H3 avec couleur custom", () => {
    const block: HeadingBlock = {
      type: "heading",
      id: "h2",
      content: "Section",
      level: "h3",
      color: "#FF5722",
    }
    const html = renderHeadingBlock(block)
    expect(html).toContain("font-size:18px")
    expect(html).toContain("#FF5722")
  })

  it("devrait respecter l'alignement", () => {
    const block: HeadingBlock = {
      type: "heading",
      id: "h3",
      content: "Centré",
      level: "h2",
      alignment: "center",
    }
    const html = renderHeadingBlock(block)
    expect(html).toContain('align="center"')
  })
})

describe("renderSocialBlock", () => {
  it("devrait rendre des liens sociaux avec noms capitalisés", () => {
    const block: SocialBlock = {
      type: "social",
      id: "s1",
      links: [
        { platform: "facebook", url: "https://fb.com/resto" },
        { platform: "instagram", url: "https://ig.com/resto" },
      ],
    }
    const html = renderSocialBlock(block)
    expect(html).toContain("Facebook")
    expect(html).toContain("Instagram")
    expect(html).toContain('href="https://fb.com/resto"')
    expect(html).toContain('href="https://ig.com/resto"')
  })

  it("devrait appliquer les couleurs de plateforme", () => {
    const block: SocialBlock = {
      type: "social",
      id: "s2",
      links: [{ platform: "facebook", url: "https://fb.com" }],
    }
    const html = renderSocialBlock(block)
    expect(html).toContain("#1877F2")
  })
})

describe("renderCouponBlock", () => {
  it("devrait rendre un code promo avec bordure en pointillé", () => {
    const block: CouponBlock = {
      type: "coupon",
      id: "c1",
      code: "PIZZA20",
      description: "20% de réduction",
    }
    const html = renderCouponBlock(block)
    expect(html).toContain("PIZZA20")
    expect(html).toContain("20% de réduction")
    expect(html).toContain("dashed")
  })

  it("devrait appliquer les couleurs personnalisées", () => {
    const block: CouponBlock = {
      type: "coupon",
      id: "c2",
      code: "VIP50",
      backgroundColor: "#000000",
      textColor: "#FFD700",
      borderColor: "#FFD700",
    }
    const html = renderCouponBlock(block)
    expect(html).toContain("#000000")
    expect(html).toContain("#FFD700")
  })
})

describe("renderColumnsBlock", () => {
  it("devrait rendre 2 colonnes de 50% avec blocs imbriqués", () => {
    const block: ColumnsBlock = {
      type: "columns",
      id: "col1",
      columns: [
        { blocks: [{ type: "text", id: "t1", content: "Gauche" }] },
        { blocks: [{ type: "text", id: "t2", content: "Droite" }] },
      ],
      layout: "2",
    }
    const html = renderColumnsBlock(block)
    expect(html).toContain("Gauche")
    expect(html).toContain("Droite")
    expect(html).toContain('width="50%"')
  })

  it("devrait rendre 3 colonnes de 33%", () => {
    const block: ColumnsBlock = {
      type: "columns",
      id: "col2",
      columns: [
        { blocks: [{ type: "heading", id: "h1", content: "A", level: "h3" }] },
        { blocks: [{ type: "text", id: "t1", content: "B" }] },
        { blocks: [{ type: "text", id: "t2", content: "C" }] },
      ],
      layout: "3",
    }
    const html = renderColumnsBlock(block)
    expect(html).toContain("A")
    expect(html).toContain("B")
    expect(html).toContain("C")
    expect(html).toContain('width="33%"')
  })

  it("devrait rendre &nbsp; pour une colonne vide", () => {
    const block: ColumnsBlock = {
      type: "columns",
      id: "col3",
      columns: [
        { blocks: [] },
        { blocks: [{ type: "text", id: "t1", content: "Contenu" }] },
      ],
      layout: "2",
    }
    const html = renderColumnsBlock(block)
    expect(html).toContain("&nbsp;")
    expect(html).toContain("Contenu")
  })
})

describe("renderVideoBlock", () => {
  it("devrait rendre une miniature cliquable", () => {
    const block: VideoBlock = {
      type: "video",
      id: "v1",
      thumbnailUrl: "https://img.youtube.com/vi/abc/maxresdefault.jpg",
      videoUrl: "https://youtube.com/watch?v=abc",
      alt: "Ma vidéo",
    }
    const html = renderVideoBlock(block)
    expect(html).toContain('href="https://youtube.com/watch?v=abc"')
    expect(html).toContain('src="https://img.youtube.com/vi/abc/maxresdefault.jpg"')
    expect(html).toContain('alt="Ma vidéo"')
  })

  it("devrait respecter l'alignement", () => {
    const block: VideoBlock = {
      type: "video",
      id: "v2",
      thumbnailUrl: "https://cdn.test/thumb.jpg",
      videoUrl: "https://youtube.com/watch?v=xyz",
      alignment: "right",
    }
    const html = renderVideoBlock(block)
    expect(html).toContain('align="right"')
  })
})

describe("renderHeroBlock", () => {
  it("devrait rendre un hero avec image de fond, titre et sous-titre", () => {
    const block: HeroBlock = {
      type: "hero",
      id: "hero1",
      imageUrl: "https://cdn.test/hero.jpg",
      title: "Bienvenue",
      subtitle: "Chez Pizza Express",
    }
    const html = renderHeroBlock(block)
    expect(html).toContain("Bienvenue")
    expect(html).toContain("Chez Pizza Express")
    expect(html).toContain("https://cdn.test/hero.jpg")
    expect(html).toContain("background-image")
  })

  it("devrait rendre un bouton CTA si fourni", () => {
    const block: HeroBlock = {
      type: "hero",
      id: "hero2",
      imageUrl: "https://cdn.test/hero.jpg",
      title: "Offre",
      buttonText: "Commander",
      buttonUrl: "https://shop.test",
    }
    const html = renderHeroBlock(block)
    expect(html).toContain("Commander")
    expect(html).toContain('href="https://shop.test"')
  })

  it("devrait appliquer les couleurs personnalisées", () => {
    const block: HeroBlock = {
      type: "hero",
      id: "hero3",
      imageUrl: "https://cdn.test/hero.jpg",
      title: "Test",
      textColor: "#FFD700",
      overlayColor: "rgba(0,0,0,0.6)",
    }
    const html = renderHeroBlock(block)
    expect(html).toContain("#FFD700")
    expect(html).toContain("rgba(0,0,0,0.6)")
  })

  it("devrait inclure VML pour Outlook", () => {
    const block: HeroBlock = {
      type: "hero",
      id: "hero4",
      imageUrl: "https://cdn.test/hero.jpg",
      title: "VML",
    }
    const html = renderHeroBlock(block)
    expect(html).toContain("v:rect")
    expect(html).toContain("v:fill")
  })
})

describe("renderMenuHighlightBlock", () => {
  it("devrait rendre une liste de plats avec titre", () => {
    const block: MenuHighlightBlock = {
      type: "menu_highlight",
      id: "mh1",
      title: "Nos spécialités",
      items: [
        { name: "Pizza Margherita", price: "12,90 €", description: "Sauce tomate, mozzarella" },
        { name: "Tiramisu", price: "7,50 €" },
      ],
    }
    const html = renderMenuHighlightBlock(block)
    expect(html).toContain("Nos spécialités")
    expect(html).toContain("Pizza Margherita")
    expect(html).toContain("12,90 €")
    expect(html).toContain("Sauce tomate, mozzarella")
    expect(html).toContain("Tiramisu")
    expect(html).toContain("7,50 €")
  })

  it("devrait rendre un grid avec 2+ items", () => {
    const block: MenuHighlightBlock = {
      type: "menu_highlight",
      id: "mh2",
      items: [
        { name: "Plat A", price: "10 €" },
        { name: "Plat B", price: "15 €" },
      ],
      layout: "grid",
    }
    const html = renderMenuHighlightBlock(block)
    expect(html).toContain('width="50%"')
    expect(html).toContain("Plat A")
    expect(html).toContain("Plat B")
  })

  it("devrait retourner vide sans items", () => {
    const block: MenuHighlightBlock = {
      type: "menu_highlight",
      id: "mh3",
      items: [],
    }
    const html = renderMenuHighlightBlock(block)
    expect(html).toBe("")
  })

  it("devrait appliquer la couleur d'accent", () => {
    const block: MenuHighlightBlock = {
      type: "menu_highlight",
      id: "mh4",
      items: [{ name: "Test", price: "5 €" }],
      accentColor: "#E91E63",
    }
    const html = renderMenuHighlightBlock(block)
    expect(html).toContain("#E91E63")
  })
})

describe("renderCountdownBlock", () => {
  it("devrait rendre une date limite formatée", () => {
    const block: CountdownBlock = {
      type: "countdown",
      id: "cd1",
      deadlineDate: "2026-03-15",
      title: "Offre limitée",
    }
    const html = renderCountdownBlock(block)
    expect(html).toContain("Offre limitée")
    expect(html).toContain("15")
    expect(html).toContain("mars")
    expect(html).toContain("2026")
  })

  it("devrait appliquer les couleurs personnalisées", () => {
    const block: CountdownBlock = {
      type: "countdown",
      id: "cd2",
      deadlineDate: "2026-12-31",
      backgroundColor: "#FF0000",
      textColor: "#FFFFFF",
    }
    const html = renderCountdownBlock(block)
    expect(html).toContain("#FF0000")
    expect(html).toContain("#FFFFFF")
  })

  it("devrait utiliser le titre par défaut", () => {
    const block: CountdownBlock = {
      type: "countdown",
      id: "cd3",
      deadlineDate: "2026-06-01",
    }
    const html = renderCountdownBlock(block)
    expect(html).toContain("Offre limitée")
  })
})

// ─── Phase 2+3 : Gallery, Location, Hours, Testimonial, DecorativeDivider ────

describe("renderGalleryBlock", () => {
  it("devrait rendre une grille d'images", () => {
    const block: GalleryBlock = {
      type: "gallery",
      id: "gal1",
      images: [
        { url: "https://cdn.test/img1.jpg", alt: "Photo 1" },
        { url: "https://cdn.test/img2.jpg", alt: "Photo 2" },
      ],
      columns: 2,
      gap: 8,
    }
    const html = renderGalleryBlock(block)
    expect(html).toContain('src="https://cdn.test/img1.jpg"')
    expect(html).toContain('src="https://cdn.test/img2.jpg"')
    expect(html).toContain('alt="Photo 1"')
    expect(html).toContain('width="50%"')
  })

  it("devrait retourner vide sans images", () => {
    const block: GalleryBlock = {
      type: "gallery",
      id: "gal2",
      images: [],
    }
    const html = renderGalleryBlock(block)
    expect(html).toBe("")
  })

  it("devrait rendre 3 colonnes", () => {
    const block: GalleryBlock = {
      type: "gallery",
      id: "gal3",
      images: [
        { url: "https://cdn.test/a.jpg" },
        { url: "https://cdn.test/b.jpg" },
        { url: "https://cdn.test/c.jpg" },
      ],
      columns: 3,
    }
    const html = renderGalleryBlock(block)
    expect(html).toContain('width="33%"')
  })

  it("devrait envelopper les images avec un lien si linkUrl est fourni", () => {
    const block: GalleryBlock = {
      type: "gallery",
      id: "gal4",
      images: [
        { url: "https://cdn.test/img.jpg", linkUrl: "https://shop.test/product" },
      ],
    }
    const html = renderGalleryBlock(block)
    expect(html).toContain('href="https://shop.test/product"')
  })
})

describe("renderLocationBlock", () => {
  it("devrait rendre une adresse avec ville", () => {
    const block: LocationBlock = {
      type: "location",
      id: "loc1",
      address: "123 Rue de la Paix",
      city: "Paris 75001",
    }
    const html = renderLocationBlock(block)
    expect(html).toContain("123 Rue de la Paix")
    expect(html).toContain("Paris 75001")
  })

  it("devrait rendre le téléphone et l'email", () => {
    const block: LocationBlock = {
      type: "location",
      id: "loc2",
      address: "45 Avenue Victor Hugo",
      phone: "+33 1 23 45 67 89",
      email: "contact@resto.fr",
    }
    const html = renderLocationBlock(block)
    expect(html).toContain("+33 1 23 45 67 89")
    expect(html).toContain("contact@resto.fr")
  })

  it("devrait rendre un lien vers la carte", () => {
    const block: LocationBlock = {
      type: "location",
      id: "loc3",
      address: "10 Place Bellecour",
      mapUrl: "https://maps.google.com/?q=Lyon",
    }
    const html = renderLocationBlock(block)
    expect(html).toContain('href="https://maps.google.com/?q=Lyon"')
    expect(html).toContain("Voir sur la carte")
  })

  it("devrait respecter l'alignement", () => {
    const block: LocationBlock = {
      type: "location",
      id: "loc4",
      address: "Test",
      alignment: "right",
    }
    const html = renderLocationBlock(block)
    expect(html).toContain('align="right"')
  })
})

describe("renderHoursBlock", () => {
  it("devrait rendre un tableau d'horaires avec titre", () => {
    const block: HoursBlock = {
      type: "hours",
      id: "hrs1",
      title: "Nos horaires",
      rows: [
        { day: "Lundi - Vendredi", hours: "11h00 - 22h00" },
        { day: "Samedi", hours: "10h00 - 23h00" },
      ],
    }
    const html = renderHoursBlock(block)
    expect(html).toContain("Nos horaires")
    expect(html).toContain("Lundi - Vendredi")
    expect(html).toContain("11h00 - 22h00")
    expect(html).toContain("Samedi")
    expect(html).toContain("10h00 - 23h00")
  })

  it("devrait retourner vide sans lignes", () => {
    const block: HoursBlock = {
      type: "hours",
      id: "hrs2",
      rows: [],
    }
    const html = renderHoursBlock(block)
    expect(html).toBe("")
  })

  it("devrait appliquer la couleur d'accent au titre", () => {
    const block: HoursBlock = {
      type: "hours",
      id: "hrs3",
      title: "Horaires",
      rows: [{ day: "Dim", hours: "Fermé" }],
      accentColor: "#E91E63",
    }
    const html = renderHoursBlock(block)
    expect(html).toContain("#E91E63")
  })

  it("devrait rendre sans titre", () => {
    const block: HoursBlock = {
      type: "hours",
      id: "hrs4",
      rows: [{ day: "Lundi", hours: "12h - 14h" }],
    }
    const html = renderHoursBlock(block)
    expect(html).toContain("Lundi")
    expect(html).not.toContain("colspan")
  })
})

describe("renderTestimonialBlock", () => {
  it("devrait rendre une citation avec auteur", () => {
    const block: TestimonialBlock = {
      type: "testimonial",
      id: "test1",
      quote: "Un excellent restaurant !",
      author: "Marie Dupont",
    }
    const html = renderTestimonialBlock(block)
    expect(html).toContain("Un excellent restaurant !")
    expect(html).toContain("Marie Dupont")
  })

  it("devrait rendre les étoiles", () => {
    const block: TestimonialBlock = {
      type: "testimonial",
      id: "test2",
      quote: "Superbe",
      author: "Jean",
      rating: 4,
    }
    const html = renderTestimonialBlock(block)
    // 4 étoiles pleines + 1 vide
    expect(html).toContain("&#9733;&#9733;&#9733;&#9733;&#9734;")
  })

  it("devrait rendre un avatar", () => {
    const block: TestimonialBlock = {
      type: "testimonial",
      id: "test3",
      quote: "Parfait",
      author: "Luc",
      avatarUrl: "https://cdn.test/avatar.jpg",
    }
    const html = renderTestimonialBlock(block)
    expect(html).toContain('src="https://cdn.test/avatar.jpg"')
    expect(html).toContain("border-radius:50%")
  })

  it("devrait appliquer les couleurs personnalisées", () => {
    const block: TestimonialBlock = {
      type: "testimonial",
      id: "test4",
      quote: "Bien",
      author: "X",
      backgroundColor: "#FFFDE7",
      textColor: "#4A148C",
    }
    const html = renderTestimonialBlock(block)
    expect(html).toContain("#FFFDE7")
    expect(html).toContain("#4A148C")
  })
})

describe("renderDecorativeDividerBlock", () => {
  it("devrait rendre des points par défaut", () => {
    const block: DecorativeDividerBlock = {
      type: "decorative_divider",
      id: "dd1",
      style: "dots",
    }
    const html = renderDecorativeDividerBlock(block)
    expect(html).toContain("&#9679;")
  })

  it("devrait rendre des étoiles", () => {
    const block: DecorativeDividerBlock = {
      type: "decorative_divider",
      id: "dd2",
      style: "stars",
    }
    const html = renderDecorativeDividerBlock(block)
    expect(html).toContain("&#9733;")
  })

  it("devrait rendre des vagues", () => {
    const block: DecorativeDividerBlock = {
      type: "decorative_divider",
      id: "dd3",
      style: "wave",
    }
    const html = renderDecorativeDividerBlock(block)
    expect(html).toContain("&#126;")
  })

  it("devrait rendre des losanges", () => {
    const block: DecorativeDividerBlock = {
      type: "decorative_divider",
      id: "dd4",
      style: "diamond",
    }
    const html = renderDecorativeDividerBlock(block)
    expect(html).toContain("&#9670;")
  })

  it("devrait respecter l'alignement et la couleur", () => {
    const block: DecorativeDividerBlock = {
      type: "decorative_divider",
      id: "dd5",
      style: "dots",
      alignment: "left",
      color: "#FF5722",
    }
    const html = renderDecorativeDividerBlock(block)
    expect(html).toContain('align="left"')
    expect(html).toContain("#FF5722")
  })
})
