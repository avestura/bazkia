// Usage: npm run version:set 0.2.0
// Keeps package.json, tauri.conf.json and Cargo.toml on the same version.
import { readFileSync, writeFileSync } from "node:fs"

const v = process.argv[2]
if (!v || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(v)) {
  console.error("Usage: node scripts/set-version.mjs <semver>   e.g. 0.2.0 or 0.2.0-beta.1")
  process.exit(1)
}

const json = (file) => {
  const o = JSON.parse(readFileSync(file, "utf8"))
  o.version = v
  writeFileSync(file, JSON.stringify(o, null, 2) + "\n")
}
json("package.json")
json("src-tauri/tauri.conf.json")

let cargo = readFileSync("src-tauri/Cargo.toml", "utf8")
cargo = cargo.replace(/^version = ".*"$/m, `version = "${v}"`)
writeFileSync("src-tauri/Cargo.toml", cargo)

console.log(`Set version ${v}. Next: commit, then 'git tag v${v} && git push --tags'.`)
