/**
 * The adapter the documentation tells you to write has to reach the purge.
 *
 * `S3Service.delete` removes every version of a key, and it can only do that
 * through the injected `S3Operations` adapter — `listObjectVersions` and
 * `deleteObjectVersion` are OPTIONAL on that interface, so an adapter without
 * them compiles, runs, and writes a delete marker on every single delete. On a
 * versioned bucket that keeps every byte.
 *
 * No concrete `S3Operations` adapter exists in this repository: `apps/*` talk
 * to the AWS SDK directly through `convex/cmsMediaDelete.ts`, and the only
 * adapter a consumer of the package will ever see is the one in
 * `../README.md`. That one declared four methods and neither version method, so
 * the purge — proven by `s3.test.ts` against an adapter built inline by the
 * test — was reachable by nobody who followed the documentation. The four purge
 * tests were green throughout, because what was missing was not the loop but a
 * caller able to enter it.
 *
 * So this suite tests the document. It extracts the adapter from `README.md`,
 * runs it against a stubbed SDK, and asserts the service purges. Delete either
 * version method from the README and it goes red.
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'

import { createS3Service } from '../s3/client'
import type { S3Operations, S3Service } from '../s3/types'

const README = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'README.md')

/**
 * The fenced block of `README.md` that builds an adapter and a service.
 *
 * Split on fence lines rather than matched with a regex over the whole file: a
 * regex spanning fences silently swallows the prose between two code blocks.
 */
function adapterSnippet(): string {
  const source = readFileSync(README, 'utf8')
  const block = source.split(/^```.*$/m).find((part) => part.includes('const s3Operations'))
  if (!block) {
    throw new Error(
      `${README} no longer contains a code block declaring an S3Operations adapter — ` +
        'the guard below cannot check what the documentation no longer shows.'
    )
  }
  return block
}

/** The snippet, parsed, with its import declarations removed by range. */
function executableSnippet(): string {
  const snippet = adapterSnippet()
  const parsed = ts.createSourceFile('doc.ts', snippet, ts.ScriptTarget.ES2022, true)
  let code = snippet
  // Reversed, so removing one statement does not move the offsets of the next.
  for (const statement of [...parsed.statements].reverse()) {
    if (!ts.isImportDeclaration(statement)) continue
    code = code.slice(0, statement.getStart(parsed)) + code.slice(statement.getEnd())
  }
  return code
}

/** Property names of the documented `s3Operations` object literal. */
function documentedMethods(): string[] {
  const snippet = adapterSnippet()
  const parsed = ts.createSourceFile('doc.ts', snippet, ts.ScriptTarget.ES2022, true)
  const names: string[] = []

  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 's3Operations' &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const property of node.initializer.properties) {
        const name = property.name
        if (name && (ts.isIdentifier(name) || ts.isStringLiteral(name))) names.push(name.text)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(parsed)

  if (names.length === 0) {
    throw new Error(`${README} declares s3Operations, but not as an object literal`)
  }
  return names
}

/** One AWS SDK command, as the stubbed constructors below build it. */
interface Command {
  name: string
  input: Record<string, unknown>
}

function commandStub(name: string) {
  return function build(input: Record<string, unknown>): Command {
    return { name, input }
  }
}

type Send = (command: Command) => Promise<unknown>

/**
 * Runs the documented snippet and returns what it built.
 *
 * Everything the snippet imports is passed in as a stub, so this exercises the
 * adapter's own mapping — which SDK command it sends, and how it reshapes the
 * response — without an AWS account or the SDK itself.
 */
function buildDocumented(send: Send): { s3Operations: S3Operations; s3Service: S3Service } {
  const js = ts.transpileModule(executableSnippet(), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText

  const factory = new Function(
    'S3Client',
    'PutObjectCommand',
    'GetObjectCommand',
    'DeleteObjectCommand',
    'HeadObjectCommand',
    'ListObjectVersionsCommand',
    'getSignedUrl',
    'createS3Service',
    `${js}\nreturn { s3Operations, s3Service };`
  ) as (...injected: unknown[]) => { s3Operations: S3Operations; s3Service: S3Service }

  return factory(
    class StubClient {
      send = send
    },
    commandStub('putObject'),
    commandStub('getObject'),
    commandStub('deleteObject'),
    commandStub('headObject'),
    commandStub('listObjectVersions'),
    vi.fn().mockResolvedValue('https://signed.example.com'),
    createS3Service
  )
}

describe('the S3 adapter in README.md', () => {
  it('declares the version operations the purge needs', () => {
    // Read off the object literal, not matched as a substring: the words also
    // appear in the prose and in the comments around the adapter, and a
    // substring match would pass on an adapter that only mentions them.
    expect(documentedMethods()).toEqual(
      expect.arrayContaining([
        'putObject',
        'deleteObject',
        'getSignedUrl',
        'headObject',
        'listObjectVersions',
        'deleteObjectVersion',
      ])
    )
  })

  it('purges every version, rather than reporting an unsupported adapter', async () => {
    const sent: Command[] = []
    const { s3Service } = buildDocumented(async (command) => {
      sent.push(command)
      if (command.name !== 'listObjectVersions') return {}
      return {
        Versions: [
          { Key: 'products/x.jpg', VersionId: 'v2' },
          { Key: 'products/x.jpg', VersionId: 'v1' },
        ],
        // A marker IS a version: leaving it removes the bytes and keeps the key
        // hidden and billed, so the adapter has to return both arrays.
        DeleteMarkers: [{ Key: 'products/x.jpg', VersionId: 'm1' }],
        IsTruncated: false,
      }
    })

    const result = await s3Service.delete('products/x.jpg')

    expect(result).toEqual({ outcome: 'purged', versionsDeleted: 3 })
    expect(
      sent
        .filter((command) => command.name === 'deleteObject')
        .map((command) => command.input.VersionId)
    ).toEqual(['v2', 'v1', 'm1', undefined])
  })

  it('filters a page to the key asked for, not to the prefix', async () => {
    // The S3 API is prefix-based and `products/x.jpg` is a prefix of
    // `products/x.jpg.bak`. The service filters too, so this pins the adapter's
    // half: it must report the neighbour's key honestly rather than relabel
    // every row with the key it was asked about.
    const { s3Operations } = buildDocumented(async () => ({
      Versions: [
        { Key: 'products/x.jpg', VersionId: 'v1' },
        { Key: 'products/x.jpg.bak', VersionId: 'bak1' },
      ],
      IsTruncated: false,
    }))

    const page = await s3Operations.listObjectVersions?.({ prefix: 'products/x.jpg' })

    expect(page?.versions).toEqual([
      { key: 'products/x.jpg', versionId: 'v1', isDeleteMarker: false },
      { key: 'products/x.jpg.bak', versionId: 'bak1', isDeleteMarker: false },
    ])
  })

  it('stops paginating when S3 says the listing is complete', async () => {
    // S3 returns NextKeyMarker on a complete page too. An adapter that hands it
    // back unconditionally makes the purge walk its 100-page ceiling on every
    // delete, re-deleting the same versions each time.
    const { s3Operations } = buildDocumented(async () => ({
      Versions: [{ Key: 'products/x.jpg', VersionId: 'v1' }],
      IsTruncated: false,
      NextKeyMarker: 'products/x.jpg',
      NextVersionIdMarker: 'v1',
    }))

    expect(s3Operations.listObjectVersions).toBeTypeOf('function')
    const page = await s3Operations.listObjectVersions?.({ prefix: 'products/x.jpg' })

    expect(page?.nextKeyMarker).toBeUndefined()
    expect(page?.nextVersionIdMarker).toBeUndefined()
  })
})
