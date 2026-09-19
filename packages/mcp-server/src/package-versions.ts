/**
 * GENERATED FILE — do not edit by hand.
 *
 * Run `pnpm --filter @be-yours/mcp-server sync:versions` after a version
 * bump. `src/__tests__/registry.test.ts` fails when this drifts from the
 * workspace package.json files.
 */

export const PACKAGE_VERSIONS = {
  "admin": "1.0.0",
  "cms": "1.0.0",
  "convex-functions": "1.0.0",
  "convex-schema": "1.0.0",
  "core": "1.0.0",
  "integrations": "1.0.0",
  "marketing": "1.0.0",
  "restaurant": "1.0.0",
  "ui": "1.0.0",
} as const;

export type RegisteredPackage = keyof typeof PACKAGE_VERSIONS;

/** Version this MCP server reports over the wire, from its own package.json. */
export const MCP_SERVER_VERSION = "1.0.0";
