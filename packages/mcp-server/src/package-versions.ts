/**
 * GENERATED FILE — do not edit by hand.
 *
 * Run `pnpm --filter @be-in-digital/mcp-server sync:versions` after a version
 * bump. `src/__tests__/registry.test.ts` fails when this drifts from the
 * workspace package.json files.
 */

export const PACKAGE_VERSIONS = {
  "admin": "10.0.0",
  "cms": "3.1.0",
  "convex-functions": "5.0.0",
  "convex-schema": "4.1.0",
  "core": "2.5.0",
  "integrations": "2.2.0",
  "marketing": "2.1.0",
  "restaurant": "3.1.0",
  "ui": "3.1.0",
} as const;

export type RegisteredPackage = keyof typeof PACKAGE_VERSIONS;

/** Version this MCP server reports over the wire, from its own package.json. */
export const MCP_SERVER_VERSION = "1.0.4";
