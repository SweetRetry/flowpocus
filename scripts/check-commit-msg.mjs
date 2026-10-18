// Enforces Conventional Commits with an English (ASCII) message.
// Usage: node scripts/check-commit-msg.mjs <path-to-COMMIT_EDITMSG>
import { readFileSync } from "node:fs"

const TYPES = [
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
  "revert",
]
const HEADER = new RegExp(`^(${TYPES.join("|")})(\\([a-z0-9._/-]+\\))?!?: [^A-Z\\s].{0,99}$`)
const PASSTHROUGH = /^(Merge |Revert "|fixup! |squash! |amend! )/

const lines = readFileSync(process.argv[2], "utf8")
  .split("\n")
  .filter((line) => !line.startsWith("#"))
const message = lines.join("\n").trim()
const header = lines.find((line) => line.trim() !== "") ?? ""

const errors = []
if (!PASSTHROUGH.test(header) && !HEADER.test(header)) {
  errors.push(
    `Header must match "<type>(<scope>)?: <subject>", lowercase subject start, max 100 chars.`,
    `Allowed types: ${TYPES.join(", ")}.`
  )
}
// biome-ignore lint/suspicious/noControlCharactersInRegex: tab and newline are allowed
if (/[^\x09\x0a\x0d\x20-\x7e]/.test(message)) {
  errors.push("Message must be written in English (ASCII characters only).")
}

if (errors.length > 0) {
  console.error(`Invalid commit message:\n  ${header}\n\n${errors.map((e) => `- ${e}`).join("\n")}`)
  console.error(`\nExample: feat(canvas): add node grouping`)
  process.exit(1)
}
