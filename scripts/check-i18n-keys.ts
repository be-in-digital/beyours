/**
 * CI script: verify all locale JSON files have the same keys as the French reference.
 *
 * Checks:
 * - Missing keys (present in fr.json but absent in other locales)
 * - Orphan keys (present in other locales but absent in fr.json)
 * - Empty values (key present but value is "")
 *
 * Usage: npx tsx scripts/check-i18n-keys.ts
 * Exit code 1 if any issue is found.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

const LOCALES_DIR = path.resolve(
  __dirname,
  '../apps/restaurant-theme/lib/i18n/locales'
)

const REFERENCE_LOCALE = 'fr'

function main() {
  const refPath = path.join(LOCALES_DIR, `${REFERENCE_LOCALE}.json`)
  if (!fs.existsSync(refPath)) {
    console.error(`Reference locale file not found: ${refPath}`)
    process.exit(1)
  }

  const refData: Record<string, string> = JSON.parse(
    fs.readFileSync(refPath, 'utf-8')
  )
  const refKeys = new Set(Object.keys(refData))

  // Check reference file itself for empty values
  const refEmpty: string[] = []
  for (const [key, value] of Object.entries(refData)) {
    if (value === '') {
      refEmpty.push(key)
    }
  }

  const localeFiles = fs
    .readdirSync(LOCALES_DIR)
    .filter((f) => f.endsWith('.json') && f !== `${REFERENCE_LOCALE}.json`)

  let hasErrors = false

  if (refEmpty.length > 0) {
    hasErrors = true
    console.error(`\n[${REFERENCE_LOCALE}.json] Empty values:`)
    for (const key of refEmpty) {
      console.error(`  - ${key}`)
    }
  }

  for (const file of localeFiles) {
    const locale = file.replace('.json', '')
    const filePath = path.join(LOCALES_DIR, file)
    const data: Record<string, string> = JSON.parse(
      fs.readFileSync(filePath, 'utf-8')
    )
    const keys = new Set(Object.keys(data))

    const missing: string[] = []
    const orphan: string[] = []
    const empty: string[] = []

    for (const key of refKeys) {
      if (!keys.has(key)) {
        missing.push(key)
      }
    }

    for (const key of keys) {
      if (!refKeys.has(key)) {
        orphan.push(key)
      }
    }

    for (const [key, value] of Object.entries(data)) {
      if (value === '') {
        empty.push(key)
      }
    }

    if (missing.length > 0 || orphan.length > 0 || empty.length > 0) {
      hasErrors = true
      console.error(`\n[${locale}.json]`)

      if (missing.length > 0) {
        console.error(`  Missing keys (${missing.length}):`)
        for (const key of missing) {
          console.error(`    - ${key}`)
        }
      }

      if (orphan.length > 0) {
        console.error(`  Orphan keys (${orphan.length}):`)
        for (const key of orphan) {
          console.error(`    - ${key}`)
        }
      }

      if (empty.length > 0) {
        console.error(`  Empty values (${empty.length}):`)
        for (const key of empty) {
          console.error(`    - ${key}`)
        }
      }
    }
  }

  if (hasErrors) {
    console.error('\ni18n key check FAILED')
    process.exit(1)
  }

  console.log(
    `i18n key check passed: ${refKeys.size} keys, ${localeFiles.length + 1} locales`
  )
}

main()
