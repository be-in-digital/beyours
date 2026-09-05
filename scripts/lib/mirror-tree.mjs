/**
 * The shippable cut of `apps/themes`, as a function.
 *
 * `scripts/publish-mirror.mjs` copies this tree onto
 * `be-in-digital/beyours-boilerplate`, and `scripts/check-mirror-css.mjs`
 * builds it to prove a client gets the stylesheet we think it does. Those two
 * have to agree on what "the tree" is, byte for byte: a checker that
 * materialises the mirror slightly differently from the publisher is checking
 * something no client ever runs. Hence one module, imported by both.
 *
 * It also replaces the `rsync` the publisher used to shell out to. rsync is
 * absent from plenty of developer machines and from the container this repo is
 * often edited in, which made the publish path impossible to exercise locally —
 * and an unexercised publish path is how `apps/themes` came to ship a
 * stylesheet nobody had ever built.
 */

import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  unlinkSync,
} from "node:fs"
import { dirname, join, posix } from "node:path"

/**
 * Never sent to the mirror, matched at the root of `apps/themes` only.
 *
 * The anchor matters. rsync matches a slash-less `--exclude` against the
 * basename at ANY depth, so `vercel.json` also swallowed `demos/vercel.json` —
 * the Vercel config of the 50 sales demos, carrying `cleanUrls` and the
 * `X-Robots-Tag: noindex` that keeps them out of Google. Excluded files are
 * also protected from `--delete`, so the copy already on the mirror could
 * never be corrected either: it was frozen, invisibly, at whatever it was the
 * day the exclusion was written. Only the root `vercel.json` is meant here —
 * it carries a `turbo-ignore` and there is no turbo workspace on the client
 * side.
 */
export const NOT_SHIPPED_ROOT = ["vercel.json"]

/** Never sent to the mirror, at any depth: build output, meaningless there. */
export const NOT_SHIPPED_ANYWHERE = [".turbo", "tsconfig.tsbuildinfo"]

/** Never overwritten and never deleted on the mirror: its own, or regenerated. */
export const MIRROR_OWNED = [".git", "node_modules", ".next", "pnpm-lock.yaml", "next-env.d.ts"]

/** True for a path the mirror must not receive. `rel` is POSIX, from the source root. */
export function isNotShipped(rel) {
  const segments = rel.split("/")
  return (
    (segments.length === 1 && NOT_SHIPPED_ROOT.includes(rel)) ||
    segments.some((s) => NOT_SHIPPED_ANYWHERE.includes(s))
  )
}

/** True for a path that belongs to the mirror and must be left exactly as found. */
export function isMirrorOwned(rel) {
  return rel.split("/").some((s) => MIRROR_OWNED.includes(s))
}

/** True for anything the sync must not touch on either side. */
export const isExcluded = (rel) => isNotShipped(rel) || isMirrorOwned(rel)

/**
 * Materialise the shippable cut of `source` into `dest`.
 *
 * With `prune` (what the publisher wants — rsync's `--delete`) anything in
 * `dest` that the source no longer has is removed, except what the mirror owns.
 * Without it (what the checker wants) `dest` is simply filled.
 *
 * @returns {{ copied: string[], deleted: string[] }} POSIX paths, source-relative.
 */
export function materializeMirror(source, dest, { prune = true } = {}) {
  const copied = []
  const deleted = []

  const walkSource = (rel) => {
    const from = rel ? join(source, rel) : source
    for (const entry of readdirSync(from, { withFileTypes: true })) {
      const childRel = rel ? posix.join(rel, entry.name) : entry.name
      if (isExcluded(childRel)) continue

      const src = join(source, childRel)
      const dst = join(dest, childRel)

      // A path that changed KIND between syncs — a file that became a
      // directory, or the reverse. rsync replaced it; plain `mkdir`/`copyFile`
      // would abort the whole publish with ENOTDIR or EISDIR, on a job that has
      // already cloned the mirror and is about to push it.
      const stale = existsSync(dst) && lstatSync(dst).isDirectory() !== entry.isDirectory()
      if (stale) rmSync(dst, { recursive: true, force: true })

      if (entry.isDirectory()) {
        // Deliberately no mkdir here: a directory is created when something is
        // actually put in it. Creating it up front left `templates/*/` empty on
        // the mirror whenever its only contents were excluded build output —
        // which the prune pass below then deleted, on every run, and reported
        // as a removal. Git cannot represent an empty directory anyway, so
        // there is nothing to lose.
        walkSource(childRel)
        continue
      }
      mkdirSync(dirname(dst), { recursive: true })
      if (entry.isSymbolicLink()) {
        // rsync -a copies a symlink as a symlink. None exist under
        // `apps/themes` today; one pointing at `packages/` would dangle on the
        // mirror, which is the defect this module exists to make visible.
        rmSync(dst, { force: true })
        symlinkSync(readlinkSync(src), dst)
        copied.push(childRel)
        continue
      }
      copyFileSync(src, dst)
      chmodSync(dst, lstatSync(src).mode & 0o7777)
      copied.push(childRel)
    }
  }

  mkdirSync(dest, { recursive: true })
  walkSource("")
  const shipped = new Set(copied)

  if (prune) {
    const walkDest = (rel) => {
      const from = rel ? join(dest, rel) : dest
      for (const entry of readdirSync(from, { withFileTypes: true })) {
        const childRel = rel ? posix.join(rel, entry.name) : entry.name
        // An excluded path is protected from deletion, as it is under rsync:
        // the mirror's `.git` and lockfile are the point of the mirror.
        if (isExcluded(childRel)) continue
        if (entry.isDirectory()) {
          walkDest(childRel)
          if (readdirSync(join(dest, childRel)).length === 0) {
            rmSync(join(dest, childRel), { recursive: true })
            deleted.push(childRel)
          }
          continue
        }
        if (!shipped.has(childRel)) {
          unlinkSync(join(dest, childRel))
          deleted.push(childRel)
        }
      }
    }
    walkDest("")
  }

  return { copied, deleted }
}
