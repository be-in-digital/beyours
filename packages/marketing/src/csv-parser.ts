/**
 * CSV subscriber parser
 *
 * Parses a CSV string into structured subscriber data for import.
 * Detects email, firstName, lastName, tags columns automatically.
 */

export interface ParsedSubscriber {
  email: string
  firstName?: string
  lastName?: string
  tags: string[]
}

export interface CsvParseResult {
  subscribers: ParsedSubscriber[]
  errors: CsvParseError[]
  totalRows: number
  validRows: number
  skippedRows: number
}

export interface CsvParseError {
  row: number
  message: string
  rawLine: string
}

// Common column name aliases
const EMAIL_ALIASES = ["email", "e-mail", "mail", "courriel", "adresse email", "adresse mail"]
const FIRSTNAME_ALIASES = ["firstname", "first_name", "first name", "prénom", "prenom", "given name"]
const LASTNAME_ALIASES = ["lastname", "last_name", "last name", "nom", "surname", "family name"]
const TAGS_ALIASES = ["tags", "tag", "labels", "étiquettes", "groupes"]

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/['"]/g, "")
}

function detectColumn(headers: string[], aliases: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = normalizeHeader(headers[i] ?? "")
    if (aliases.some((alias) => h === alias || h.includes(alias))) {
      return i
    }
  }
  return -1
}

function parseRow(raw: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < raw.length; i++) {
    const char = raw[i]
    const next = raw[i + 1]

    if (char === '"' && inQuotes && next === '"') {
      // Escaped quote
      current += '"'
      i++
    } else if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === "," && !inQuotes) {
      result.push(current.trim())
      current = ""
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * Parse a CSV string into subscriber data.
 * First row is treated as headers.
 * Empty rows are silently skipped.
 */
export function parseSubscriberCsv(csvString: string): CsvParseResult {
  const lines = csvString
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  const errors: CsvParseError[] = []
  const subscribers: ParsedSubscriber[] = []

  if (lines.length === 0) {
    return { subscribers: [], errors: [], totalRows: 0, validRows: 0, skippedRows: 0 }
  }

  const headerLine = lines[0]
  if (!headerLine) {
    return { subscribers: [], errors: [], totalRows: 0, validRows: 0, skippedRows: 0 }
  }

  const headers = parseRow(headerLine)

  const emailIdx = detectColumn(headers, EMAIL_ALIASES)
  if (emailIdx === -1) {
    return {
      subscribers: [],
      errors: [{ row: 1, message: "Colonne 'email' introuvable dans l'en-tête", rawLine: headerLine }],
      totalRows: 0,
      validRows: 0,
      skippedRows: 0,
    }
  }

  const firstNameIdx = detectColumn(headers, FIRSTNAME_ALIASES)
  const lastNameIdx = detectColumn(headers, LASTNAME_ALIASES)
  const tagsIdx = detectColumn(headers, TAGS_ALIASES)

  const dataLines = lines.slice(1)
  let skippedRows = 0

  for (let i = 0; i < dataLines.length; i++) {
    const lineRaw = dataLines[i]
    if (!lineRaw) continue
    const rowNumber = i + 2 // 1-indexed, accounting for header row

    const cols = parseRow(lineRaw)
    const rawEmail = (cols[emailIdx] ?? "").replace(/['"]/g, "").trim().toLowerCase()

    if (!rawEmail) {
      skippedRows++
      continue
    }

    if (!isValidEmail(rawEmail)) {
      errors.push({
        row: rowNumber,
        message: `Email invalide : "${rawEmail}"`,
        rawLine: lineRaw,
      })
      skippedRows++
      continue
    }

    const rawTags = tagsIdx >= 0 ? (cols[tagsIdx] ?? "").replace(/['"]/g, "").trim() : ""
    const tags = rawTags
      ? rawTags
          .split(/[;|]/)
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
      : []

    subscribers.push({
      email: rawEmail,
      firstName:
        firstNameIdx >= 0 ? (cols[firstNameIdx] ?? "").replace(/['"]/g, "").trim() || undefined : undefined,
      lastName:
        lastNameIdx >= 0 ? (cols[lastNameIdx] ?? "").replace(/['"]/g, "").trim() || undefined : undefined,
      tags,
    })
  }

  return {
    subscribers,
    errors,
    totalRows: dataLines.length,
    validRows: subscribers.length,
    skippedRows,
  }
}
