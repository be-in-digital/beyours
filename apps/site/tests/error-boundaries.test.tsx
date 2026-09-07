/**
 * A thrown error on beyours.fr has to reach a tracker.
 *
 * This app had no `error.tsx` and no `global-error.tsx` at all — `apps/reference`
 * has four — so an uncaught render error showed a blank page and reported
 * nothing. That is the whole failure this asserts against, and it asserts it at
 * the seam rather than at the SDK: the mock below IS the tracker, and a
 * boundary that stops calling it fails here.
 *
 * Three things are checked, because all three were absent:
 *
 *  1. Every boundary file exists, at the root and in each of the three route
 *     groups whose layout carries chrome a visitor needs after a crash.
 *  2. Rendering one calls `captureException` with the error it was handed.
 *  3. Every boundary offers a way out that is not "run the same render again".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

const captureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => captureException(...args),
  captureRouterTransitionStart: () => {},
  captureRequestError: () => {},
  init: () => {},
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/* `global-error.tsx` imports the stylesheet directly, because it replaces the
   root layout and nothing above it runs. Vitest has no CSS pipeline. */
vi.mock("../app/globals.css", () => ({}));

const APP_ROOT = join(__dirname, "..", "app");

/**
 * Every boundary this app is supposed to have, and what each one is for.
 *
 * `(demo)` is deliberately absent: its 50 storefront previews are standalone
 * pages with no chrome to preserve, and the root boundary serves them
 * correctly.
 */
const BOUNDARIES = [
  {
    file: "error.tsx",
    label: "root",
    testId: "root-error",
    load: () => import("../app/error"),
  },
  {
    file: "(landing)/error.tsx",
    label: "landing",
    testId: "landing-error",
    load: () => import("../app/(landing)/error"),
  },
  {
    file: "admin/error.tsx",
    label: "admin",
    testId: "admin-error",
    load: () => import("../app/admin/error"),
  },
  {
    file: "parrainage/error.tsx",
    label: "parrainage",
    testId: "parrainage-error",
    load: () => import("../app/parrainage/error"),
  },
] as const;

type Boundary = {
  default: (props: {
    error: Error & { digest?: string };
    reset: () => void;
  }) => React.ReactElement;
};

const CRASH = Object.assign(new Error("Objects are not valid as a React child"), {
  digest: "3141592653",
});

beforeEach(() => {
  captureException.mockClear();
});

describe("error boundaries", () => {
  it.each(BOUNDARIES)("$label has a boundary file", ({ file }) => {
    expect(existsSync(join(APP_ROOT, file))).toBe(true);
  });

  it("global-error.tsx exists — the root layout's own crash reaches nothing else", () => {
    expect(existsSync(join(APP_ROOT, "global-error.tsx"))).toBe(true);
  });

  it.each(BOUNDARIES)("$label renders a way out that is not only 'Réessayer'", async ({
    load,
    testId,
  }) => {
    const mod = (await load()) as Boundary;
    /* `createElement`, not `mod.default({…})`: calling the component directly
       invokes its hooks outside any renderer and throws on the first
       `useEffect`. */
    const html = renderToStaticMarkup(
      createElement(mod.default, { error: CRASH, reset: () => {} }),
    );

    expect(html).toContain(`data-testid="${testId}"`);
    // The digest is the only handle a visitor can quote to support, and the
    // same value Sentry files the event under.
    expect(html).toContain("3141592653");
    // An `<a href>` — a link out — rather than only the retry button, which
    // re-runs the render that just failed.
    expect(html).toMatch(/<a href="\/[^"]*"/);
  });

  it("reports the error it was handed to the tracker", async () => {
    const { reportBoundaryError } = await import("@/lib/error-boundary");
    reportBoundaryError(CRASH);

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(CRASH);
  });

  it.each(BOUNDARIES)("$label is wired to that reporter", ({ file }) => {
    /* The seam above proves the reporter works; this proves each boundary is
       attached to it. Read from the source because the call happens inside an
       effect, and an effect does not run under `renderToStaticMarkup` — which
       is exactly how a boundary can render perfectly and report nothing. */
    const source = readFileSync(join(APP_ROOT, file), "utf8");

    expect(source).toContain("useErrorReport(error)");
  });

  it("global-error reports without going through lib/error-boundary", () => {
    /* It must not depend on that module: the root layout is what failed, and a
       boundary whose import cannot resolve renders nothing at all. This asserts
       the file talks to the SDK directly. */
    const source = readFileSync(join(APP_ROOT, "global-error.tsx"), "utf8");

    expect(source).toContain("Sentry.captureException");
    expect(source).not.toContain("@/lib/error-boundary");
  });
});
