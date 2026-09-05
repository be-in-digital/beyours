/**
 * Every `@be-in-digital/*` import the engine's documentation tells a reader to
 * write has to compile.
 *
 * The registry was not the only place describing an API nobody wrote. The same
 * fiction ran through `apps/docs`, the package READMEs and the `@example` blocks
 * in the sources themselves: `uploadToS3`, `translateWithGPT`, `checkPermission`,
 * `createStripePayment`, `import { sanitizeSvg } from "@be-in-digital/cms"`,
 * `@be-in-digital/themes` (a package that was deleted). Prose cannot be
 * type-checked, so none of it ever failed anything.
 *
 * Code fences are parsed with the TypeScript parser rather than matched with a
 * regex — a regex over `from "..."` clauses reads names out of surrounding prose
 * and invents failures that are not there.
 *
 * Scope note: this checks that each imported NAME exists at the PATH the document
 * names. It does not execute the snippets, so a wrong argument list inside one
 * still gets through; `packages/mcp-server`'s own tests cover the registry's
 * shape, and reviewers cover the rest.
 */

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { describe, expect, it } from "vitest"

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const repoRoot = resolve(appRoot, "..", "..")
const probePath = join(appRoot, "engine-doc-probe.ts")

const ENGINE_SCOPE = "@be-in-digital/"

/**
 * `_project/` is an explicitly superseded architecture archive and `tasks/` is
 * backlog prose quoting broken imports on purpose — neither is instruction to a
 * reader. Everything else that documents the engine is in scope.
 */
const SKIP_DIRECTORIES = new Set([
  "node_modules",
  "dist",
  ".next",
  ".turbo",
  "coverage",
  "_project",
  "tasks",
  ".git",
])

interface DocClaim {
  /** Repo-relative path of the document making the claim. */
  file: string
  /** 1-based line within that document. */
  line: number
  importPath: string
  /** The imported name, or undefined for `import * as ns` / bare imports. */
  name?: string
}

function walk(directory: string, keep: (path: string) => boolean): string[] {
  const found: string[] = []
  for (const entry of readdirSync(directory)) {
    if (SKIP_DIRECTORIES.has(entry)) continue
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) found.push(...walk(path, keep))
    else if (keep(path)) found.push(path)
  }
  return found
}

function documentedFiles(): string[] {
  // CHANGELOG.md is deliberately absent: it is a historical record, and an entry
  // that quoted an import as it stood then should not be rewritten now.
  const markdown = [
    join(repoRoot, "CLAUDE.md"),
    join(repoRoot, "README.md"),
    ...walk(join(repoRoot, "apps"), (p) => p.endsWith(".md")),
    ...walk(join(repoRoot, "packages"), (p) => p.endsWith(".md")),
  ]
  const sources = walk(
    join(repoRoot, "packages"),
    (p) => p.endsWith(".ts") || p.endsWith(".tsx")
  )
  return [...markdown, ...sources]
}

/** Fenced TypeScript blocks, as `{ code, line }` with `line` 1-based in the file. */
function fencedBlocks(source: string): { code: string; line: number }[] {
  const blocks: { code: string; line: number }[] = []
  const lines = source.split("\n")
  let open: { language: string; line: number; body: string[] } | undefined
  for (const [index, text] of lines.entries()) {
    const fence = /^\s*```+\s*([A-Za-z]*)/.exec(text)
    if (!open && fence) {
      open = { language: (fence[1] ?? "").toLowerCase(), line: index + 2, body: [] }
      continue
    }
    if (open && /^\s*```+\s*$/.test(text)) {
      if (["ts", "typescript", "tsx", "js", "jsx"].includes(open.language)) {
        blocks.push({ code: open.body.join("\n"), line: open.line })
      }
      open = undefined
      continue
    }
    open?.body.push(text)
  }
  return blocks
}

/** Only comments: a real import in package source is the compiler's problem, not ours. */
function commentBlocks(source: string): string {
  const comments: string[] = []
  const block = /\/\*[\s\S]*?\*\//g
  for (const [text] of source.matchAll(block)) {
    comments.push(text.replace(/^\s*\*/gm, ""))
  }
  for (const [, text] of source.matchAll(/(^|\n)\s*\/\/ ?(.*)/g)) {
    comments.push(text ?? "")
  }
  return comments.join("\n")
}

function claimsIn(code: string, file: string, blockLine: number): DocClaim[] {
  const parsed = ts.createSourceFile(
    "snippet.tsx",
    code,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TSX
  )
  const claims: DocClaim[] = []
  for (const statement of parsed.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    const specifier = statement.moduleSpecifier
    if (!ts.isStringLiteral(specifier)) continue
    if (!specifier.text.startsWith(ENGINE_SCOPE)) continue

    const line =
      blockLine +
      parsed.getLineAndCharacterOfPosition(statement.getStart(parsed)).line
    const bindings = statement.importClause?.namedBindings
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        claims.push({
          file,
          line,
          importPath: specifier.text,
          name: (element.propertyName ?? element.name).text,
        })
      }
    } else {
      // `import * as ns` or a bare import: the path is the only claim made.
      claims.push({ file, line, importPath: specifier.text })
    }
  }
  return claims
}

function collectClaims(): DocClaim[] {
  const claims: DocClaim[] = []
  for (const path of documentedFiles()) {
    const file = relative(repoRoot, path)
    const source = readFileSync(path, "utf8")
    if (!source.includes(ENGINE_SCOPE)) continue

    if (path.endsWith(".md")) {
      for (const { code, line } of fencedBlocks(source)) {
        claims.push(...claimsIn(code, file, line))
      }
    } else {
      // Line numbers inside extracted comments do not map back, so report the
      // file and let the reader grep — the import text is in the message.
      for (const { code } of fencedBlocks(commentBlocks(source))) {
        claims.push(...claimsIn(code, file, 0))
      }
    }
  }
  return claims
}

const claims = collectClaims()

function renderProbe(): string {
  return (
    claims
      .map(({ importPath, name }, index) =>
        name === undefined
          ? `import type * as Doc${index} from "${importPath}";`
          : `import type { ${name} as Doc${index} } from "${importPath}";`
      )
      .join("\n") + "\n"
  )
}

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

function describeFailure(diagnostic: ts.Diagnostic): string {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")
  if (diagnostic.file === undefined || diagnostic.start === undefined) {
    return `TS${diagnostic.code}: ${message}`
  }
  const { line } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
  const claim = claims[line]
  if (!claim) return `probe line ${line + 1} — TS${diagnostic.code}: ${message}`
  const where = claim.line > 0 ? `${claim.file}:${claim.line}` : claim.file
  const what = claim.name ? `${claim.name} from ` : ""
  return `${where} — ${what}${claim.importPath} — TS${diagnostic.code}: ${message}`
}

describe("engine documentation imports", () => {
  it("finds the documented imports at all", () => {
    // A broken extractor would otherwise report a clean sweep of nothing.
    expect(claims.length).toBeGreaterThan(120)
    expect(new Set(claims.map((claim) => claim.file)).size).toBeGreaterThan(8)
  })

  it("resolves every import the documentation tells a reader to write", () => {
    const source = renderProbe()
    expect(source.trimEnd().split("\n")).toHaveLength(claims.length)

    const failures = [...new Set(compileProbe(source).map(describeFailure))].sort()
    expect(failures).toEqual([])
  })
})
