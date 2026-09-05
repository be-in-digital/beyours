import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['react', 'react-dom', 'radix-ui'],
  // The allergen vocabulary is a raw-source subpath export
  // (@be-in-digital/core/allergens). Bundling it keeps `dist` free of a
  // runtime `require` for a TypeScript file that a plain Node consumer could
  // not load. One source of truth in the repo; the copy in `dist` is inert.
  noExternal: ['@be-in-digital/core'],
  jsx: 'automatic',
  splitting: false,
})
