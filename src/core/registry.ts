import type { ToolDef } from "./types"

const tools = new Map<string, ToolDef>()

export function registerTool(def: ToolDef) {
  if (tools.has(def.id)) throw new Error(`duplicate tool id: ${def.id}`)
  tools.set(def.id, def)
}

export const getTool = (id: string) => tools.get(id)
export const allTools = () => [...tools.values()]

/** Fixed display order; anything unlisted sorts after, alphabetically. */
export const CATEGORY_ORDER = [
  "Input",
  "Output",
  "Data format",
  "Encoding",
  "Hashing",
  "Crypto",
  "Arithmetic",
  "Bitwise",
  "Text",
  "Regex",
  "Networking",
  "Date & time",
  "Extractors",
  "Compression",
  "Code",
  "Analysis",
  "Generators",
]

export function categories(): { name: string; tools: ToolDef[] }[] {
  const map = new Map<string, ToolDef[]>()
  for (const t of tools.values()) {
    if (!map.has(t.category)) map.set(t.category, [])
    map.get(t.category)!.push(t)
  }
  const idx = (n: string) => {
    const i = CATEGORY_ORDER.indexOf(n)
    return i < 0 ? 999 : i
  }
  return [...map.entries()]
    .sort((a, b) => idx(a[0]) - idx(b[0]) || a[0].localeCompare(b[0]))
    .map(([name, list]) => ({ name, tools: list.sort((a, b) => a.name.localeCompare(b.name)) }))
}

/** Scored fuzzy search over name, keywords, category and description. */
export function searchTools(query: string, limit = 50): ToolDef[] {
  const q = query.trim().toLowerCase()
  if (!q) return allTools().slice(0, limit)
  const words = q.split(/\s+/)
  const scored: [number, ToolDef][] = []
  for (const t of tools.values()) {
    const name = t.name.toLowerCase()
    const hay = `${name} ${(t.keywords ?? []).join(" ").toLowerCase()} ${t.category.toLowerCase()} ${t.description.toLowerCase()}`
    let score = 0
    let ok = true
    for (const w of words) {
      if (name === w) score += 100
      else if (name.startsWith(w)) score += 60
      else if (name.includes(w)) score += 40
      else if (hay.includes(w)) score += 10
      else if (subsequence(w, name)) score += 4
      else {
        ok = false
        break
      }
    }
    if (ok) scored.push([score + Math.max(0, 10 - name.length / 4), t])
  }
  return scored.sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name)).slice(0, limit).map((s) => s[1])
}

function subsequence(needle: string, hay: string) {
  let i = 0
  for (const c of hay) if (c === needle[i]) i++
  return i === needle.length
}
