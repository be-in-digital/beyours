import { defineConfig } from 'tsup'

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
  external: ['react', 'react-dom', '@be-in-digital/core'],
  // `@be-in-digital/core/allergens` is a raw-source subpath export — a `.ts`
  // file. Left external, `dist` would carry a runtime `require` for TypeScript
  // that a plain Node consumer could not load, and `apps/reference` does not
  // list the engine packages in `transpilePackages`. Bundling this one subpath
  // keeps the rest of core external, as it has to be: core's root entry pulls
  // in the AWS SDK. Same reasoning as `packages/ui/tsup.config.ts`.
  // `@be-in-digital/convex-schema` is the same shape and was left external, so
  // `dist` carried a runtime `require` for TypeScript. It worked everywhere it
  // was tried: in this monorepo the package resolves OUTSIDE `node_modules`, and
  // Node strips types there. A client site installs it from the registry, where
  // it is under `node_modules` and Node refuses —
  //
  //   Error: Stripping types is currently unsupported for files under
  //   node_modules, for ".../@be-in-digital/convex-schema/src/index.ts"
  //
  // — which is every Playwright spec importing a value from this package, on
  // every client repo. It surfaced on the mirror's own CI the first time that
  // suite got far enough to run (#516).
  //
  // Bundled, not repackaged: `convex-schema` publishes raw `.ts` deliberately,
  // because the Convex bundler compiles it and the schema has to stay readable
  // as source. The four helpers this package uses are pure functions and a
  // constant — no singleton to duplicate, unlike the stores above.
  noExternal: ['@be-in-digital/core/allergens', '@be-in-digital/convex-schema'],
})
