/**
 * Structural guards over the registry data.
 *
 * The registry is hand-maintained, and for a long time nothing checked it:
 * `tsc` sees only strings, and this package's `test` script was
 * `vitest run --passWithNoTests` over zero files, so it exited 0 forever. It
 * had drifted to 23 false claims out of 148 and nine versions frozen at 2.0.1
 * while `@be-yours/admin` had reached 8.0.0.
 *
 * These tests cover the parts that can be settled from the workspace manifests
 * alone. Whether each claim's *symbol* actually exists is a compile question,
 * and lives in `apps/reference/__tests__/mcp-registry-imports.test.ts` — that is
 * where the nine packages are resolvable the way a consumer resolves them.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { packages, importStatement, importBinding } from "../registry.js";
import { MCP_SERVER_VERSION, PACKAGE_VERSIONS } from "../package-versions.js";

const here = dirname(fileURLToPath(import.meta.url));
const packagesDir = resolve(here, "..", "..", "..");

type ExportsMap = string | Record<string, unknown> | undefined;

interface Manifest {
  name?: string;
  version?: string;
  main?: string;
  exports?: ExportsMap;
}

function readManifest(packageDir: string): Manifest {
  return JSON.parse(
    readFileSync(join(packagesDir, packageDir, "package.json"), "utf8"),
  ) as Manifest;
}

/** Every `./subpath -> target` pair a package declares, conditions flattened. */
function declaredSubpaths(manifest: Manifest): Map<string, string[]> {
  const found = new Map<string, string[]>();
  const exportsMap = manifest.exports;
  if (typeof exportsMap === "string") {
    found.set(".", [exportsMap]);
    return found;
  }
  if (!exportsMap) {
    if (manifest.main) found.set(".", [manifest.main]);
    return found;
  }
  const keys = Object.keys(exportsMap);
  if (keys.length > 0 && !keys.some((key) => key.startsWith("."))) {
    // Conditions at the top level, e.g. { types, import, require }: the whole
    // object is the "." target rather than a map of subpaths.
    found.set(".", collectTargets(exportsMap));
    return found;
  }
  for (const [subpath, target] of Object.entries(exportsMap)) {
    found.set(subpath, collectTargets(target));
  }
  return found;
}

function collectTargets(target: unknown): string[] {
  if (typeof target === "string") return [target];
  if (target && typeof target === "object") {
    return Object.values(target as Record<string, unknown>).flatMap(collectTargets);
  }
  return [];
}

/** `@be-yours/admin/pages` -> `{ pkg: "admin", subpath: "./pages" }`. */
function splitImportPath(importPath: string): { pkg: string; subpath: string } | undefined {
  const match = /^@be-yours\/([a-z-]+)(\/.*)?$/.exec(importPath);
  if (!match?.[1]) return undefined;
  return { pkg: match[1], subpath: match[2] ? `.${match[2]}` : "." };
}

const allExports = packages.flatMap((pkg) => pkg.exports.map((exp) => ({ pkg, exp })));

describe("registry versions", () => {
  it("describes every workspace package it names", () => {
    for (const pkg of packages) {
      expect(readManifest(pkg.name).name).toBe(pkg.scope);
    }
  });

  it.each(Object.keys(PACKAGE_VERSIONS))("reports the workspace version of %s", (name) => {
    const generated = PACKAGE_VERSIONS[name as keyof typeof PACKAGE_VERSIONS];
    // If this fails, run: pnpm --filter @be-yours/mcp-server sync:versions
    expect(generated).toBe(readManifest(name).version);
  });

  it("serves the generated version for every package, never a literal", () => {
    for (const pkg of packages) {
      expect(pkg.version).toBe(PACKAGE_VERSIONS[pkg.name]);
    }
  });

  it("reports its own version, and not the one it was generated before", () => {
    // MCP_SERVER_VERSION is what `server.ts` hands a client over the wire, and
    // it is generated from this package's own package.json — but it was the one
    // entry in the file nothing compared. The other nine are asserted above, so
    // a stale generated file was caught for every package except the one doing
    // the reporting. A release that bumps this package and forgets
    // `sync:versions` would have gone out announcing the version before it.
    // If this fails, run: pnpm --filter @be-yours/mcp-server sync:versions
    expect(MCP_SERVER_VERSION).toBe(readManifest("mcp-server").version);
  });
});

describe("declared export subpaths", () => {
  // G-3 was `packages/admin` declaring "./pages": "./src/pages/index.ts" with no
  // such file — a module-not-found for anyone following the exports map, and the
  // reason ten registry page claims were unreachable.
  it.each(Object.keys(PACKAGE_VERSIONS))(
    "%s resolves every subpath it declares to a file that exists",
    (name) => {
      const manifest = readManifest(name);
      const missing: string[] = [];
      for (const [subpath, targets] of declaredSubpaths(manifest)) {
        for (const target of targets) {
          if (target.startsWith("./dist/")) continue; // build output, see below
          const absolute = join(packagesDir, name, target);
          try {
            readFileSync(absolute);
          } catch {
            missing.push(`${subpath} -> ${target}`);
          }
        }
      }
      expect(missing).toEqual([]);
    },
  );

  it("only points a subpath at dist/ when tsup builds that entry", () => {
    const offenders: string[] = [];
    for (const name of Object.keys(PACKAGE_VERSIONS)) {
      const distTargets = [...declaredSubpaths(readManifest(name)).values()]
        .flat()
        .filter((target) => target.startsWith("./dist/"));
      if (distTargets.length === 0) continue;

      let tsupConfig: string;
      try {
        tsupConfig = readFileSync(join(packagesDir, name, "tsup.config.ts"), "utf8");
      } catch {
        offenders.push(`${name}: exports dist/ but has no tsup.config.ts`);
        continue;
      }
      for (const target of new Set(distTargets)) {
        // ./dist/env/index.d.ts -> src/env/index — the tsup entry that makes it
        const entry = target
          .replace(/^\.\/dist\//, "src/")
          .replace(/\.(d\.ts|d\.mts|mjs|cjs|js)$/, "");
        if (!tsupConfig.includes(`${entry}.ts`)) {
          offenders.push(`${name}: ${target} has no tsup entry ${entry}.ts`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("registry claims", () => {
  it("has claims to check", () => {
    // Guards against a refactor that empties the registry and turns every
    // it.each below into a silent zero-case pass.
    expect(allExports.length).toBeGreaterThan(140);
  });

  it.each(allExports.map(({ pkg, exp }) => [pkg.name, exp.name, exp] as const))(
    "%s: %s imports from a subpath its package declares",
    (_pkgName, _expName, exp) => {
      const parsed = splitImportPath(exp.importPath);
      expect(parsed, `unparseable importPath: ${exp.importPath}`).toBeDefined();
      if (!parsed) return;

      const manifest = readManifest(parsed.pkg);
      expect(
        [...declaredSubpaths(manifest).keys()],
        `${exp.importPath} is not in ${parsed.pkg}'s exports map`,
      ).toContain(parsed.subpath);
    },
  );

  it("gives every claim a name that can be imported", () => {
    const identifier = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
    for (const { pkg, exp } of allExports) {
      for (const segment of exp.name.split(".")) {
        expect(segment, `${pkg.name}: ${exp.name}`).toMatch(identifier);
      }
    }
  });

  it("never renders a dotted name as a named import", () => {
    // `import { uberEats.pullMenu } from '...'` is not syntax. The dotted names
    // are members of a namespace re-export, and importStatement must bring in
    // the namespace instead.
    const dotted = allExports.filter(({ exp }) => exp.name.includes("."));
    expect(dotted.length).toBeGreaterThan(0);
    for (const { exp } of dotted) {
      expect(importStatement(exp)).not.toContain(".");
      expect(importStatement(exp)).toContain(`{ ${importBinding(exp)} }`);
    }
  });

  it("declares each export once per package", () => {
    for (const pkg of packages) {
      const names = pkg.exports.map((exp) => `${exp.importPath}#${exp.name}`);
      expect(new Set(names).size, `duplicate claim in ${pkg.name}`).toBe(names.length);
    }
  });
});
