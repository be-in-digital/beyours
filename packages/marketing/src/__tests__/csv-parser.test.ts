import { describe, it, expect } from "vitest"
import { parseSubscriberCsv } from "../csv-parser"

describe("parseSubscriberCsv", () => {
  describe("parsing basique", () => {
    it("devrait parser un CSV simple avec email uniquement", () => {
      const csv = `email
alice@example.com
bob@example.com`
      const result = parseSubscriberCsv(csv)
      expect(result.validRows).toBe(2)
      expect(result.totalRows).toBe(2)
      expect(result.skippedRows).toBe(0)
      expect(result.subscribers).toHaveLength(2)
      expect(result.subscribers[0]?.email).toBe("alice@example.com")
    })

    it("devrait parser un CSV complet avec toutes les colonnes", () => {
      const csv = `email,first_name,last_name,tags
alice@example.com,Alice,Martin,vip;premium
bob@example.com,Bob,Dupont,nouveau`
      const result = parseSubscriberCsv(csv)
      expect(result.validRows).toBe(2)
      expect(result.subscribers[0]).toEqual({
        email: "alice@example.com",
        firstName: "Alice",
        lastName: "Martin",
        tags: ["vip", "premium"],
      })
    })

    it("devrait convertir les emails en minuscules", () => {
      const csv = `email
ALICE@EXAMPLE.COM`
      const result = parseSubscriberCsv(csv)
      expect(result.subscribers[0]?.email).toBe("alice@example.com")
    })
  })

  describe("détection de colonnes", () => {
    it("devrait détecter courriel et étiquettes (alias FR)", () => {
      const csv = `courriel,étiquettes
test@example.com,tag1;tag2`
      const result = parseSubscriberCsv(csv)
      expect(result.validRows).toBe(1)
      expect(result.subscribers[0]?.email).toBe("test@example.com")
      expect(result.subscribers[0]?.tags).toEqual(["tag1", "tag2"])
    })

    it("devrait détecter prénom via alias français", () => {
      const csv = `courriel,prénom
test@example.com,Jean`
      const result = parseSubscriberCsv(csv)
      expect(result.subscribers[0]?.firstName).toBe("Jean")
    })

    it("devrait détecter les alias e-mail", () => {
      const csv = `e-mail
test@example.com`
      const result = parseSubscriberCsv(csv)
      expect(result.validRows).toBe(1)
    })

    it("devrait échouer si la colonne email est introuvable", () => {
      const csv = `name,phone
Alice,0612345678`
      const result = parseSubscriberCsv(csv)
      expect(result.validRows).toBe(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]?.message).toContain("email")
    })
  })

  describe("gestion des erreurs", () => {
    it("devrait ignorer les lignes vides", () => {
      const csv = `email

alice@example.com

bob@example.com
`
      const result = parseSubscriberCsv(csv)
      expect(result.validRows).toBe(2)
    })

    it("devrait signaler les emails invalides", () => {
      const csv = `email
valid@example.com
invalid-email
another@bad
ok@test.com`
      const result = parseSubscriberCsv(csv)
      expect(result.validRows).toBe(2)
      expect(result.skippedRows).toBe(2)
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
    })

    it("devrait retourner un résultat vide pour un CSV vide", () => {
      const result = parseSubscriberCsv("")
      expect(result.totalRows).toBe(0)
      expect(result.validRows).toBe(0)
      expect(result.subscribers).toHaveLength(0)
    })

    it("devrait ignorer les lignes sans email", () => {
      const csv = `email,first_name
alice@example.com,Alice
,Bob`
      const result = parseSubscriberCsv(csv)
      expect(result.validRows).toBe(1)
      expect(result.skippedRows).toBe(1)
    })
  })

  describe("tags", () => {
    it("devrait parser les tags séparés par des points-virgules", () => {
      const csv = `email,tags
alice@example.com,vip;premium;gold`
      const result = parseSubscriberCsv(csv)
      expect(result.subscribers[0]?.tags).toEqual(["vip", "premium", "gold"])
    })

    it("devrait parser les tags séparés par des pipes", () => {
      const csv = `email,tags
alice@example.com,vip|premium`
      const result = parseSubscriberCsv(csv)
      expect(result.subscribers[0]?.tags).toEqual(["vip", "premium"])
    })

    it("devrait retourner un tableau vide si pas de tags", () => {
      const csv = `email,tags
alice@example.com,`
      const result = parseSubscriberCsv(csv)
      expect(result.subscribers[0]?.tags).toEqual([])
    })
  })

  describe("CSV avec guillemets", () => {
    it("devrait gérer les champs entre guillemets", () => {
      const csv = `email,first_name,last_name
"alice@example.com","Alice","De La Rue"`
      const result = parseSubscriberCsv(csv)
      expect(result.subscribers[0]?.email).toBe("alice@example.com")
      expect(result.subscribers[0]?.lastName).toBe("De La Rue")
    })

    it("devrait gérer les guillemets échappés (quotes stripped post-parse)", () => {
      // parseRow handles "" → " correctly, but the field extraction
      // strips remaining quotes with .replace(/['"]/g, "")
      const csv = `email,first_name
alice@example.com,"Al""ice"`
      const result = parseSubscriberCsv(csv)
      expect(result.subscribers[0]?.firstName).toBe("Alice")
    })
  })

  describe("retours à la ligne", () => {
    it("devrait gérer les retours CRLF", () => {
      const csv = "email\r\nalice@example.com\r\nbob@example.com"
      const result = parseSubscriberCsv(csv)
      expect(result.validRows).toBe(2)
    })
  })
})
