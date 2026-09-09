/**
 * GENERATED FILE — do not edit by hand.
 *
 * Run `pnpm --filter @be-in-digital/mcp-server sync:versions` after a version
 * bump. `src/__tests__/registry.test.ts` fails when this drifts from the
 * workspace package.json files.
 */

export const PACKAGE_VERSIONS = {
  "admin": "12.0.0",
  "cms": "3.1.0",
  "convex-functions": "6.1.0",
  "convex-schema": "6.0.0",
  "core": "4.0.0",
  "integrations": "2.2.2",
  "marketing": "3.0.0",
  "restaurant": "4.1.0",
  "ui": "4.1.0",
} as const;

export type RegisteredPackage = keyof typeof PACKAGE_VERSIONS;

/** Version this MCP server reports over the wire, from its own package.json. */
export const MCP_SERVER_VERSION = "1.1.1";
