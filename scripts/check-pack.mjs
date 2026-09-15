/**
 * Fail if the publishable tarball is missing anything a consumer needs.
 *
 * dist/ is gitignored, so a fresh clone that publishes without building would
 * otherwise ship a tarball containing only the README, the licence and
 * package.json — installable, and completely non-functional. npm forbids
 * re-publishing a version, so that mistake costs a version number permanently.
 */
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)))

/** Every path the exports map and the legacy entry fields point at. */
const required = new Set(["LICENSE", "README.md"])
for (const entry of Object.values(pkg.exports)) {
  if (typeof entry === "string") continue
  for (const target of Object.values(entry)) required.add(target)
}
for (const field of ["main", "module", "types", "unpkg", "jsdelivr"]) {
  if (pkg[field]) required.add(pkg[field])
}

const normalise = (p) => p.replace(/^\.\//, "")

const [{ files }] = JSON.parse(
  execFileSync("npm", ["pack", "--dry-run", "--json"], { encoding: "utf8" })
)
const packed = new Set(files.map((f) => normalise(f.path)))

const missing = [...required].map(normalise).filter((p) => !packed.has(p))

if (missing.length) {
  console.error(
    `npm pack would ship ${packed.size} files, missing ${missing.length} required:\n` +
      missing.map((p) => `  - ${p}`).join("\n") +
      "\n\nRun `yarn build` before publishing."
  )
  process.exit(1)
}

console.log(`npm pack looks publishable: ${packed.size} files, all entry points present.`)
