# @be-yours/mcp-server

> Model Context Protocol (MCP) server for AI assistants to navigate and use the @be-yours package ecosystem.

## Table of Contents

- [What is MCP?](#what-is-mcp)
- [Installation](#installation)
- [Setup with Claude Code](#setup-with-claude-code)
- [Setup with Cursor](#setup-with-cursor)
- [Setup with Other Editors](#setup-with-other-editors)
- [Available Resources](#available-resources)
- [Available Tools](#available-tools)
- [Running Manually](#running-manually)

## What is MCP?

The **Model Context Protocol (MCP)** is an open standard that allows AI assistants to access external tools and data sources. The `@be-yours/mcp-server` exposes the entire package ecosystem — components, hooks, stores, functions, types — to any MCP-compatible AI assistant.

This means your AI coding assistant can:
- Search for components and functions across all 10 packages
- Get usage examples with correct import paths
- Access setup guides for each package
- Browse the full API surface

## Installation

### From GitHub Packages

```bash
pnpm add @be-yours/mcp-server
```

### From Source (in the monorepo)

```bash
cd packages/mcp-server
pnpm build
```

## Setup with Claude Code

Add to your Claude Code MCP configuration (`~/.claude/mcp.json` or project `.claude/mcp.json`):

```json
{
  "mcpServers": {
    "beindigital": {
      "command": "npx",
      "args": ["@be-yours/mcp-server"],
      "env": {
        "GITHUB_TOKEN": "your_github_pat"
      }
    }
  }
}
```

Or if installed locally:

```json
{
  "mcpServers": {
    "beindigital": {
      "command": "node",
      "args": ["./node_modules/@be-yours/mcp-server/dist/index.js"]
    }
  }
}
```

## Setup with Cursor

Add to your Cursor MCP settings (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "beindigital": {
      "command": "npx",
      "args": ["@be-yours/mcp-server"]
    }
  }
}
```

## Setup with Other Editors

Any editor or tool that supports MCP can use this server. The binary name is `beindigital-mcp`:

```bash
# Run directly
npx @be-yours/mcp-server

# Or if globally installed
beindigital-mcp
```

The server communicates over **stdio** using the MCP JSON-RPC protocol.

## Available Resources

### `beindigital://packages`

Lists all available packages with descriptions, categories, and export counts.

### `beindigital://packages/{name}`

Detailed information about a specific package including all exports, setup steps, dependencies, and examples.

**Example:** `beindigital://packages/ui` returns full documentation for @be-yours/ui.

## Available Tools

### `search_feature`

Search for components, hooks, stores, functions, and types across all packages.

**Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `query` | `string` | Search term (e.g., "cart", "button", "order") |

**Example usage by AI:**
> "Search for payment-related features" → `search_feature({ query: "payment" })`

### `get_package_info`

Get full details about a specific package.

**Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `name` | `string` | Package name (e.g., "ui", "core", "@be-yours/restaurant") |

### `get_usage_example`

Get usage examples and import paths for a specific export.

**Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `exportName` | `string` | Export name (e.g., "Button", "useCartStore", "formatPrice") |

### `get_setup_guide`

Get step-by-step setup instructions for using a package in a new project.

**Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `packageName` | `string` | Package name (e.g., "core", "ui") |

### `list_by_category`

List packages filtered by category.

**Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `category` | `"frontend" \| "backend" \| "shared" \| "tooling"` | Package category |

## Running Manually

For development and testing:

```bash
# Build
cd packages/mcp-server
pnpm build

# Run
node dist/index.js
```

The server expects JSON-RPC messages on stdin and responds on stdout, following the MCP specification.

## Architecture

```
scripts/
└── sync-package-versions.mjs   # Regenerates package-versions.ts from the workspace
src/
├── index.ts                    # Entry point (calls startServer)
├── server.ts                   # MCP server setup (resources + tools)
├── registry.ts                 # Package metadata registry
├── package-versions.ts         # GENERATED — do not hand-edit
└── __tests__/registry.test.ts  # Structural guards over the registry data
```

The registry describes the **nine** engine packages (`mcp-server` documents itself
here rather than in its own registry). It is a curated selection of each package's
surface, not an exhaustive dump: the entries carry hand-written descriptions,
import paths, props/params, examples and tags.

### Keeping it true

The registry is hand-maintained, and it drifted badly before anything checked it —
23 of 148 claims named symbols or subpaths that did not exist, and every package
version read `2.0.1` while `@be-yours/admin` had reached `8.0.0`. Two things
hold it now:

- **Versions are derived.** `src/package-versions.ts` is generated from the
  workspace `package.json` files by `pnpm --filter @be-yours/mcp-server
  sync:versions`. Run it after a version bump; the tests fail if you forget.
- **Every claim is compiled.** `apps/reference/__tests__/mcp-registry-imports.test.ts`
  renders one import per registry entry — through `importStatement()`, the same
  function the server prints — and type-checks the lot against the real packages.
  A claim that names a missing export or an undeclared subpath fails the build.
  Its sibling `engine-doc-imports.test.ts` does the same for every `@be-yours`
  import in the repository's Markdown and JSDoc.

When you add an entry, give it the import path a consumer would really write —
including a subpath where the export is not on the package barrel, as with
`@be-yours/cms/sanitize`.
