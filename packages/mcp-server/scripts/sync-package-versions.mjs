/**
 * Regenerates `src/package-versions.ts` from the workspace package.json files.
 *
 * The registry used to carry a hand-typed `version` per package. Every one of
 * them said 2.0.1 while `@be-in-digital/admin` had reached 8.0.0 — six majors
 * of drift that nothing could catch, because a stale string still compiles.
 * The versions are derived now, and `src/__tests__/registry.test.ts` fails if
 * this file falls behind the workspace.
 *
 * Usage: pnpm --filter @be-in-digital/mcp-server sync:versions
 */
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

/** The engine packages the registry describes. `mcp-server` describes itself. */
const REGISTERED_PACKAGES = [
  "admin",
  "cms",
  "convex-functions",
  "convex-schema",
  "core",
  "integrations",
  "marketing",
  "restaurant",
  "ui",
]

const here = dirname(fileURLToPath(import.meta.url))
const packagesDir = join(here, "..", "..")
const outFile = join(here, "..", "src", "package-versions.ts")

function readVersion(packageName) {
  const manifest = JSON.parse(
    readFileSync(join(packagesDir, packageName, "package.json"), "utf8")
  )
  if (typeof manifest.version !== "string") {
    throw new Error(`packages/${packageName}/package.json has no "version"`)
  }
  return manifest.version
}

const entries = REGISTERED_PACKAGES.map(
  (name) => `  "${name}": "${readVersion(name)}",`
).join("\n")

writeFileSync(
  outFile,
  `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Run \`pnpm --filter @be-in-digital/mcp-server sync:versions\` after a version
 * bump. \`src/__tests__/registry.test.ts\` fails when this drifts from the
 * workspace package.json files.
 */

export const PACKAGE_VERSIONS = {
${entries}
} as const;

export type RegisteredPackage = keyof typeof PACKAGE_VERSIONS;

/** Version this MCP server reports over the wire, from its own package.json. */
export const MCP_SERVER_VERSION = "${readVersion("mcp-server")}";
`,
  "utf8"
)

console.log(`Wrote ${outFile}`)
