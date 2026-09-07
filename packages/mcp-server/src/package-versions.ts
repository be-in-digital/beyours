/**
 * GENERATED FILE — do not edit by hand.
 *
 * Run `pnpm --filter @be-in-digital/mcp-server sync:versions` after a version
 * bump. `src/__tests__/registry.test.ts` fails when this drifts from the
 * workspace package.json files.
 */

export const PACKAGE_VERSIONS = {
  "admin": "9.0.1",
  "cms": "3.1.0",
  "convex-functions": "4.0.0",
  "convex-schema": "4.0.0",
  "core": "2.4.0",
  "integrations": "2.2.0",
  "marketing": "2.1.0",
  "restaurant": "3.0.0",
  "ui": "3.0.0",
} as const;

export type RegisteredPackage = keyof typeof PACKAGE_VERSIONS;

/** Version this MCP server reports over the wire, from its own package.json. */
export const MCP_SERVER_VERSION = "1.0.4";
