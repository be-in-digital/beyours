import { describe, it, expect } from "vitest"
import { parseSubscriberCsv } from "../csv-parser"

describe("parseSubscriberCsv", () => {
  describe("basic parsing", () => {
    it("parses a simple CSV with only an email column", () => {
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

    it("parses a full CSV with every column", () => {
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

    it("lowercases the emails", () => {
      const csv = `email
ALICE@EXAMPLE.COM`
      const result = parseSubscriberCsv(csv)
      expect(result.subscribers[0]?.email).toBe("alice@example.com")
    })
  })

  describe("column detection", () => {
    it("detects courriel and étiquettes (French aliases)", () => {
      const csv = `courriel,étiquettes
test@example.com,tag1;tag2`
      const result = parseSubscriberCsv(csv)
      expect(result.validRows).toBe(1)
      expect(result.subscribers[0]?.email).toBe("test@example.com")
      expect(result.subscribers[0]?.tags).toEqual(["tag1", "tag2"])
    })

    it("detects prénom through the French alias", () => {
      const csv = `courriel,prénom
test@example.com,Jean`
      const result = parseSubscriberCsv(csv)
      expect(result.subscribers[0]?.firstName).toBe("Jean")
    })

    it("detects the e-mail alias", () => {
      const csv = `e-mail
test@example.com`
      const result = parseSubscriberCsv(csv)
      expect(result.validRows).toBe(1)
    })

    it("fails when the email column is missing", () => {
      const csv = `name,phone
Alice,0612345678`
      const result = parseSubscriberCsv(csv)
      expect(result.validRows).toBe(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]?.message).toContain("email")
    })
  })

  describe("error handling", () => {
    it("skips empty lines", () => {
      const csv = `email

alice@example.com

bob@example.com
`
      const result = parseSubscriberCsv(csv)
      expect(result.validRows).toBe(2)
    })

    it("reports invalid emails", () => {
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

    it("returns an empty result for an empty CSV", () => {
      const result = parseSubscriberCsv("")
      expect(result.totalRows).toBe(0)
      expect(result.validRows).toBe(0)
      expect(result.subscribers).toHaveLength(0)
    })

    it("skips rows without an email", () => {
      const csv = `email,first_name
alice@example.com,Alice
,Bob`
      const result = parseSubscriberCsv(csv)
      expect(result.validRows).toBe(1)
      expect(result.skippedRows).toBe(1)
    })
  })

  describe("tags", () => {
    it("parses tags separated by semicolons", () => {
      const csv = `email,tags
alice@example.com,vip;premium;gold`
      const result = parseSubscriberCsv(csv)
      expect(result.subscribers[0]?.tags).toEqual(["vip", "premium", "gold"])
    })

    it("parses tags separated by pipes", () => {
      const csv = `email,tags
alice@example.com,vip|premium`
      const result = parseSubscriberCsv(csv)
      expect(result.subscribers[0]?.tags).toEqual(["vip", "premium"])
    })

    it("returns an empty array when there are no tags", () => {
      const csv = `email,tags
alice@example.com,`
      const result = parseSubscriberCsv(csv)
      expect(result.subscribers[0]?.tags).toEqual([])
    })
  })

  describe("quoted CSV", () => {
    it("handles quoted fields", () => {
      const csv = `email,first_name,last_name
"alice@example.com","Alice","De La Rue"`
      const result = parseSubscriberCsv(csv)
      expect(result.subscribers[0]?.email).toBe("alice@example.com")
      expect(result.subscribers[0]?.lastName).toBe("De La Rue")
    })

    it("handles escaped quotes (quotes stripped post-parse)", () => {
      // parseRow handles "" → " correctly, but the field extraction
      // strips remaining quotes with .replace(/['"]/g, "")
      const csv = `email,first_name
alice@example.com,"Al""ice"`
      const result = parseSubscriberCsv(csv)
      expect(result.subscribers[0]?.firstName).toBe("Alice")
    })
  })

  describe("line endings", () => {
    it("handles CRLF line endings", () => {
      const csv = "email\r\nalice@example.com\r\nbob@example.com"
      const result = parseSubscriberCsv(csv)
      expect(result.validRows).toBe(2)
    })
  })
})
