import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { defineConfig } from 'tsup'

/**
 * Every `@be-yours/core` subpath whose export target is raw TypeScript.
 *
 * READ, NOT LISTED. This was two literals — `./allergens` and, after a client's
 * Playwright run found it, `./status-labels`. Core declares NINE such subpaths
 * and gains more; a hand-written list is one import away from being wrong
 * again, and wrong here means a `dist` that a consumer cannot load at all.
 *
 * Subpaths that are absent from this list because their target is `dist` stay
 * external, which they must: core's root entry pulls in the AWS SDK.
 */
function rawSourceSubpathsOfCore(): string[] {
  const here = dirname(fileURLToPath(import.meta.url))
  const manifest = JSON.parse(
    readFileSync(join(here, '../core/package.json'), 'utf8')
  ) as { exports?: Record<string, unknown> }

  return Object.entries(manifest.exports ?? {})
    .filter(([, target]) => typeof target === 'string' && target.endsWith('.ts'))
    .map(([subpath]) => `@be-yours/core${subpath.replace(/^\./, '')}`)
}

export default defineConfig({
  // One entry per subpath declared in package.json "exports". Building only
  // src/index.ts would leave ./stores, ./services and ./hooks pointing at
  // files that never exist — including in the published tarball.
  entry: [
    'src/index.ts',
    'src/stores/index.ts',
    'src/services/index.ts',
    'src/hooks/index.ts',
  ],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  // Mandatory with several entries: the Zustand stores must stay singletons.
  // Without splitting, each entry inlines its own copy of cart.ts and a
  // consumer mixing the root and ./stores gets two independent carts.
  splitting: true,
  external: ['react', 'react-dom', '@be-yours/core'],
  // `@be-yours/core/allergens` is a raw-source subpath export — a `.ts`
  // file. Left external, `dist` would carry a runtime `require` for TypeScript
  // that a plain Node consumer could not load, and `apps/reference` does not
  // list the engine packages in `transpilePackages`. Bundling this one subpath
  // keeps the rest of core external, as it has to be: core's root entry pulls
  // in the AWS SDK. Same reasoning as `packages/ui/tsup.config.ts`.
  // `@be-yours/convex-schema` is the same shape and was left external, so
  // `dist` carried a runtime `require` for TypeScript. It worked everywhere it
  // was tried: in this monorepo the package resolves OUTSIDE `node_modules`, and
  // Node strips types there. A client site installs it from the registry, where
  // it is under `node_modules` and Node refuses —
  //
  //   Error: Stripping types is currently unsupported for files under
  //   node_modules, for ".../@be-yours/convex-schema/src/index.ts"
  //
  // — which is every Playwright spec importing a value from this package, on
  // every client repo. It surfaced on the mirror's own CI the first time that
  // suite got far enough to run (#516).
  //
  // Bundled, not repackaged: `convex-schema` publishes raw `.ts` deliberately,
  // because the Convex bundler compiles it and the schema has to stay readable
  // as source. The four helpers this package uses are pure functions and a
  // constant — no singleton to duplicate, unlike the stores above.
  //
  // THE LIST IS DERIVED (#516 follow-up). `@be-yours/core/status-labels` is
  // a third subpath of the same shape and was missed by the two literals that
  // used to be here — found by `engine-bundle-loads.test.ts` on CI, whose Node
  // 20 cannot strip types AT ALL, where a developer's Node 24 strips them
  // happily and the guard passed. Reading core's own export map is what stops a
  // fourth.
  noExternal: [...rawSourceSubpathsOfCore(), '@be-yours/convex-schema'],
})
