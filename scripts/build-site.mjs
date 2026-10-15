// Assembles the GitHub Pages site into _site/:
//   _site/            the landing page (site/)
//   _site/app/        the app itself, built for the browser
//   _site/assets/     Boxy stylesheets, fonts, tool catalogue
import { execFileSync } from "node:child_process"
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "inherit"], shell: process.platform === "win32", ...opts })

rmSync("_site", { recursive: true, force: true })
mkdirSync("_site/assets/fonts", { recursive: true })

console.log("building the app for the browser…")
run("npx", ["vite", "build", "--base=./", "--outDir", "_site/app", "--emptyOutDir"])

cpSync("site", "_site", { recursive: true })
cpSync("src/styles/boxy.css", "_site/assets/boxy.css")
cpSync("src/styles/boxy-components.css", "_site/assets/boxy-components.css")
cpSync("public/boxy-icons.svg", "_site/assets/boxy-icons.svg")
cpSync("public/favicon.svg", "_site/favicon.svg")
for (const f of ["inter", "inter-tight", "jetbrains-mono"]) {
  cpSync(`node_modules/@fontsource-variable/${f}/files/${f}-latin-wght-normal.woff2`, `_site/assets/fonts/${f}.woff2`)
}

console.log("writing the tool catalogue…")
const manifest = run("npx", ["vite-node", "scripts/tools-manifest.ts"]).toString()
writeFileSync("_site/assets/tools.json", manifest)
const { total, categories } = JSON.parse(manifest)

const version = JSON.parse(readFileSync("package.json", "utf8")).version
const page = readFileSync("_site/index.html", "utf8")
  .replaceAll("{{VERSION}}", version)
  .replaceAll("{{TOOL_COUNT}}", String(total))
  .replaceAll("{{CATEGORY_COUNT}}", String(categories.length))
writeFileSync("_site/index.html", page)
writeFileSync("_site/.nojekyll", "")
console.log(`site ready: ${total} tools in ${categories.length} categories, v${version}`)
