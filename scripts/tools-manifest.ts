// Run with: npx vite-node scripts/tools-manifest.ts > tools.json
// Emits the tool catalogue for the website so it can never disagree with the app.
import "../src/tools"
import { categories } from "../src/core/registry"

const out = categories().map((c) => ({
  name: c.name,
  tools: c.tools.map((t) => ({ id: t.id, name: t.name, description: t.description, inputs: t.inputs.length, outputs: t.outputs.length, params: t.params.length })),
}))
process.stdout.write(JSON.stringify({ total: out.reduce((n, c) => n + c.tools.length, 0), categories: out }))
