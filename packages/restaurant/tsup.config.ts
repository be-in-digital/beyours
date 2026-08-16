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
})
