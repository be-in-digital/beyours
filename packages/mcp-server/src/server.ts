import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  packages,
  searchPackages,
  getPackageByName,
  type PackageInfo,
  type PackageExport,
} from "./registry.js";

function formatPackageList(pkgs: PackageInfo[]): string {
  return pkgs
    .map(
      (p) =>
        `## ${p.scope}\n${p.description}\n- Category: ${p.category}\n- Install: \`${p.installCommand}\`\n- Exports: ${p.exports.length}`
    )
    .join("\n\n");
}

function formatPackageDetail(pkg: PackageInfo): string {
  const sections: string[] = [
    `# ${pkg.scope}`,
    `> ${pkg.description}`,
    `- **Version**: ${pkg.version}`,
    `- **Category**: ${pkg.category}`,
    `- **Install**: \`${pkg.installCommand}\``,
  ];

  if (pkg.dependencies.length) {
    sections.push(`- **Dependencies**: ${pkg.dependencies.join(", ")}`);
  }
  if (pkg.peerDependencies?.length) {
    sections.push(
      `- **Peer Dependencies**: ${pkg.peerDependencies.join(", ")}`
    );
  }

  if (pkg.setupSteps?.length) {
    sections.push("\n## Setup\n" + pkg.setupSteps.map((s, i) => `${i + 1}. ${s}`).join("\n"));
  }

  const grouped = new Map<string, PackageExport[]>();
  for (const exp of pkg.exports) {
    const key = exp.type;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(exp);
  }

  sections.push("\n## Exports");
  for (const [type, exports] of grouped) {
    sections.push(`\n### ${type.charAt(0).toUpperCase() + type.slice(1)}s`);
    for (const exp of exports) {
      let line = `- **${exp.name}**: ${exp.description}`;
      if (exp.importPath) line += ` (\`import from '${exp.importPath}'\`)`;
      if (exp.example) line += `\n  \`\`\`tsx\n  ${exp.example}\n  \`\`\``;
      if (exp.props) {
        const propLines = Object.entries(exp.props)
          .map(
            ([k, v]) =>
              `  - \`${k}\`: ${v.type}${v.required ? " (required)" : ""} — ${v.description}`
          )
          .join("\n");
        line += `\n  Props:\n${propLines}`;
      }
      if (exp.params) {
        const paramLines = Object.entries(exp.params)
          .map(([k, v]) => `  - \`${k}\`: ${v.type} — ${v.description}`)
          .join("\n");
        line += `\n  Params:\n${paramLines}`;
      }
      sections.push(line);
    }
  }

  return sections.join("\n");
}

function formatSearchResults(
  results: PackageExport[],
  query: string
): string {
  if (results.length === 0) {
    return `No results found for "${query}".`;
  }
  const lines = results.map(
    (r) =>
      `- **${r.name}** (${r.type}) — ${r.description}\n  Import: \`${r.importPath}\`${r.example ? `\n  Example: \`${r.example}\`` : ""}`
  );
  return `# Search: "${query}"\n${results.length} result(s)\n\n${lines.join("\n\n")}`;
}

export async function startServer() {
  const server = new McpServer({
    name: "beindigital-engine",
    version: "1.0.0",
  });

  // --- Resources ---

  server.resource("packages-list", "beindigital://packages", async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "text/markdown",
        text: `# @be-in-digital Package Ecosystem\n\n${packages.length} packages available.\n\n${formatPackageList(packages)}`,
      },
    ],
  }));

  server.resource(
    "package-detail",
    new ResourceTemplate("beindigital://packages/{name}", {
      list: async () =>
        packages.map((p) => ({
          uri: `beindigital://packages/${p.name}`,
          name: p.scope,
          description: p.description,
        })),
    }),
    async (uri, { name }) => {
      const pkg = getPackageByName(name as string);
      if (!pkg) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Package "${name}" not found. Available: ${packages.map((p) => p.name).join(", ")}`,
            },
          ],
        };
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: formatPackageDetail(pkg),
          },
        ],
      };
    }
  );

  // --- Tools ---

  server.tool(
    "search_feature",
    "Search for components, hooks, stores, functions, types across all @be-in-digital packages",
    { query: z.string().describe("Search term (e.g. 'cart', 'button', 'order', 'kitchen')") },
    async ({ query }) => {
      const results = searchPackages(query);
      return {
        content: [
          {
            type: "text" as const,
            text: formatSearchResults(results, query),
          },
        ],
      };
    }
  );

  server.tool(
    "get_package_info",
    "Get full details about a specific package including all exports, setup steps, and dependencies",
    { name: z.string().describe("Package name (e.g. 'ui', 'core', 'restaurant', '@be-in-digital/ui')") },
    async ({ name }) => {
      const pkg = getPackageByName(name);
      if (!pkg) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Package "${name}" not found.\nAvailable packages: ${packages.map((p) => `${p.name} (${p.scope})`).join(", ")}`,
            },
          ],
        };
      }
      return {
        content: [{ type: "text" as const, text: formatPackageDetail(pkg) }],
      };
    }
  );

  server.tool(
    "get_usage_example",
    "Get usage examples and import paths for a specific export",
    {
      exportName: z.string().describe("Export name (e.g. 'Button', 'useCartStore', 'formatPrice')"),
    },
    async ({ exportName }) => {
      const q = exportName.toLowerCase();
      for (const pkg of packages) {
        const exp = pkg.exports.find((e) => e.name.toLowerCase() === q);
        if (exp) {
          const lines = [
            `# ${exp.name}`,
            `> ${exp.description}`,
            `- **Type**: ${exp.type}`,
            `- **Package**: ${pkg.scope}`,
            `- **Import**: \`import { ${exp.name} } from '${exp.importPath}'\``,
          ];
          if (exp.example) {
            lines.push(`\n## Example\n\`\`\`tsx\n${exp.example}\n\`\`\``);
          }
          if (exp.props) {
            lines.push("\n## Props");
            for (const [k, v] of Object.entries(exp.props)) {
              lines.push(
                `- \`${k}\`: \`${v.type}\`${v.required ? " **(required)**" : ""} — ${v.description}`
              );
            }
          }
          if (exp.params) {
            lines.push("\n## Parameters");
            for (const [k, v] of Object.entries(exp.params)) {
              lines.push(`- \`${k}\`: \`${v.type}\` — ${v.description}`);
            }
          }
          if (exp.returnType) {
            lines.push(`\n**Returns**: \`${exp.returnType}\``);
          }
          if (exp.tags?.length) {
            lines.push(`\n**Tags**: ${exp.tags.join(", ")}`);
          }
          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
          };
        }
      }
      return {
        content: [
          {
            type: "text" as const,
            text: `Export "${exportName}" not found. Try search_feature to find similar exports.`,
          },
        ],
      };
    }
  );

  server.tool(
    "get_setup_guide",
    "Get step-by-step setup instructions for a package in a new project",
    {
      packageName: z.string().describe("Package name (e.g. 'core', 'ui')"),
    },
    async ({ packageName }) => {
      const pkg = getPackageByName(packageName);
      if (!pkg) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Package "${packageName}" not found.`,
            },
          ],
        };
      }

      const lines = [
        `# Setup Guide: ${pkg.scope}`,
        `> ${pkg.description}`,
        "\n## Prerequisites",
        "1. Configure your `.npmrc` for GitHub Packages:",
        "```",
        "@be-in-digital:registry=https://npm.pkg.github.com",
        '//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}',
        "```",
        "2. Set `GITHUB_TOKEN` environment variable with a PAT that has `read:packages` scope.",
        `\n## Installation\n\`\`\`bash\n${pkg.installCommand}\n\`\`\``,
      ];

      if (pkg.dependencies.length) {
        lines.push(`\n## Dependencies\nAutomatically installed: ${pkg.dependencies.join(", ")}`);
      }
      if (pkg.peerDependencies?.length) {
        lines.push(
          `\n## Peer Dependencies (install manually)\n\`\`\`bash\npnpm add ${pkg.peerDependencies.join(" ")}\n\`\`\``
        );
      }
      if (pkg.setupSteps?.length) {
        lines.push("\n## Setup Steps");
        pkg.setupSteps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
      }

      lines.push(
        "\n## Vercel Deployment",
        "Add `GITHUB_TOKEN` (with `read:packages`) as an environment variable in your Vercel project:",
        "```bash",
        "vercel env add GITHUB_TOKEN",
        "```"
      );

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );

  server.tool(
    "list_by_category",
    "List packages filtered by category",
    {
      category: z
        .enum(["frontend", "backend", "shared", "tooling"])
        .describe("Package category"),
    },
    async ({ category }) => {
      const filtered = packages.filter((p) => p.category === category);
      if (filtered.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No packages found in category "${category}".`,
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: `# ${category.charAt(0).toUpperCase() + category.slice(1)} Packages\n\n${formatPackageList(filtered)}`,
          },
        ],
      };
    }
  );

  // --- Start ---
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
