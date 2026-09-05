/**
 * Every claim in the MCP registry has to compile.
 *
 * `packages/mcp-server/src/registry.ts` is the answer a contractor gets when they
 * ask what the engine exports. It was hand-maintained with no test and no
 * generator, and 23 of its 148 claims named symbols or subpaths that do not
 * exist — `uploadToS3`, `sendEmail`, `@be-in-digital/admin/pages`,
 * `uberEats.client`. Nothing could catch it: to `tsc` the registry is a list of
 * strings, and the owning package's `test` script was `--passWithNoTests` over
 * zero files.
 *
 * The check lives here rather than in `packages/mcp-server` because this app is
 * where the nine engine packages resolve the way a consumer resolves them — the
 * built `dist` entry points and the raw-source subpaths alike. `turbo`'s `test`
 * task already depends on `^build`, so the `dist` halves are present.
 *
 * The import text comes from `importStatement()`, the same function the server
 * prints in `get_example` and `search_feature`. What a consumer is told to paste
 * is therefore what gets compiled here.
 */

import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { describe, expect, it } from "vitest"

import {
  importStatement,
  packages,
  type PackageExport,
} from "../../../packages/mcp-server/src/registry"

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const probePath = join(appRoot, "mcp-registry-probe.ts")

interface Claim {
  packageName: string
  export: PackageExport
}

const claims: Claim[] = packages.flatMap((pkg) =>
  pkg.exports.map((exp) => ({ packageName: pkg.name, export: exp }))
)

/**
 * One line per claim, so a diagnostic's line number names the claim that failed.
 *
 * `import type` is the right existence probe: it errors when the name is not
 * exported (TS2305/TS2724) or the module does not resolve (TS2307), and never
 * on a value-versus-type mismatch, which is not what is being asserted here. A
 * dotted claim is a member of a namespace re-export, so it needs a value import
 * plus a `typeof` on the member — that is what raises TS2339 when the member is
 * absent.
 */
function renderProbe(): string {
  return (
    claims
      .map(({ export: exp }, index) => {
        const alias = `Probe${index}`
        const parts = /^import \{ (\S+) \} from '(.+)'$/.exec(importStatement(exp))
        if (!parts) {
          // importStatement changed shape. Say so, rather than emitting an
          // unaliased probe and burying the cause under duplicate-identifier
          // errors on every claim.
          throw new Error(
            `cannot alias importStatement output: ${importStatement(exp)}`
          )
        }
        const statement = `import { ${parts[1]} as ${alias} } from "${parts[2]}";`
        const [, ...member] = exp.name.split(".")
        const memberCheck =
          member.length > 0
            ? ` type ${alias}Member = typeof ${alias}.${member.join(".")};`
            : ""
        return exp.name.includes(".")
          ? `${statement}${memberCheck}`
          : `${statement.replace(/^import /, "import type ")}`
      })
      .join("\n") + "\n"
  )
}

/** The app's own compiler options, so the probe is judged the way the app is. */
function compilerOptions(): ts.CompilerOptions {
  const configPath = join(appRoot, "tsconfig.json")
  const { config, error } = ts.readConfigFile(configPath, (path) =>
    readFileSync(path, "utf8")
  )
  if (error) {
    throw new Error(ts.flattenDiagnosticMessageText(error.messageText, "\n"))
  }
  const parsed = ts.parseJsonConfigFileContent(
    config,
    ts.sys,
    appRoot,
    undefined,
    configPath
  )
  return { ...parsed.options, noEmit: true, incremental: false }
}

/**
 * Compiles the probe from memory — nothing is written into the app, so a failing
 * run cannot leave a stray file behind for `pnpm type-check` to trip over.
 */
function compileProbe(source: string): ts.Diagnostic[] {
  const options = compilerOptions()
  const host = ts.createCompilerHost(options, true)

  const readOriginal = host.readFile.bind(host)
  const getSourceOriginal = host.getSourceFile.bind(host)
  const existsOriginal = host.fileExists.bind(host)

  host.readFile = (fileName) =>
    fileName === probePath ? source : readOriginal(fileName)
  host.fileExists = (fileName) =>
    fileName === probePath || existsOriginal(fileName)
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) =>
    fileName === probePath
      ? ts.createSourceFile(fileName, source, languageVersion, true)
      : getSourceOriginal(fileName, languageVersion, onError, shouldCreate)

  const program = ts.createProgram([probePath], options, host)
  const probeFile = program.getSourceFile(probePath)
  if (!probeFile) throw new Error("the probe did not make it into the program")

  return [
    ...program.getSyntacticDiagnostics(probeFile),
    ...program.getSemanticDiagnostics(probeFile),
  ]
}

/** `Probe12` -> the claim on line 13, so a failure names the export, not a line. */
function describeFailure(diagnostic: ts.Diagnostic): string {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")
  if (diagnostic.file === undefined || diagnostic.start === undefined) {
    return `TS${diagnostic.code}: ${message}`
  }
  const { line } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
  const claim = claims[line]
  const where = claim
    ? `${claim.packageName}: ${claim.export.name} (${claim.export.importPath})`
    : `probe line ${line + 1}`
  return `${where} — TS${diagnostic.code}: ${message}`
}

describe("MCP registry claims", () => {
  it("describes enough of the engine to be worth checking", () => {
    // Without this, emptying the registry would turn the compile below into a
    // vacuous pass.
    expect(claims.length).toBeGreaterThan(140)
  })

  it("compiles every import it tells a consumer to write", () => {
    const source = renderProbe()
    expect(source.trimEnd().split("\n")).toHaveLength(claims.length)

    const failures = compileProbe(source).map(describeFailure)
    expect(failures).toEqual([])
  })
})
