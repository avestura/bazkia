import { bool_, num, select, simple, str_, text, toggle } from "./kit"

const CAT = "Code"

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys)
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => [k, sortKeys(x)]))
  return v
}

simple({
  id: "code:jsonFormat",
  name: "JSON beautify",
  category: CAT,
  description: "Pretty-prints JSON with the indent you choose. Errors point at what is wrong.",
  keywords: ["format", "pretty", "indent", "prettify"],
  params: [select("indent", "Indent", [["2", "2 spaces"], ["4", "4 spaces"], ["tab", "Tab"]]), toggle("sort", "Sort keys", false)],
  run: (s: string, p) => {
    const v = JSON.parse(s)
    return JSON.stringify(bool_(p, "sort") ? sortKeys(v) : v, null, p.indent === "tab" ? "\t" : Number(p.indent))
  },
})

simple({
  id: "code:jsonMinify",
  name: "JSON minify",
  category: CAT,
  description: "Removes all insignificant whitespace from JSON.",
  keywords: ["compact", "compress", "uglify"],
  run: (s: string) => JSON.stringify(JSON.parse(s)),
})

export function jsonPath(data: unknown, path: string): unknown {
  const tokens = path.replace(/^\$\.?/, "").match(/[^.[\]]+|\[(?:\d+|"[^"]*"|'[^']*'|\*)\]/g) ?? []
  let cur: unknown[] = [data]
  for (const t of tokens) {
    const key = t.startsWith("[") ? t.slice(1, -1).replace(/^["']|["']$/g, "") : t
    const next: unknown[] = []
    for (const c of cur) {
      if (c === null || typeof c !== "object") continue
      if (key === "*") next.push(...Object.values(c))
      else if (key in (c as object)) next.push((c as Record<string, unknown>)[key])
    }
    cur = next
  }
  return cur.length === 1 && !path.includes("*") ? cur[0] : cur
}

simple({
  id: "code:jsonPath",
  name: "JSON path",
  category: CAT,
  description: "Picks a value out of JSON. Syntax: $.users[0].name or users.0.name, with [*] to fan out.",
  keywords: ["query", "jq", "select", "extract", "get"],
  params: [text("path", "Path", "$.", { mono: true })],
  run: (s: string, p) => {
    const r = jsonPath(JSON.parse(s), str_(p, "path"))
    if (r === undefined) throw new Error("Path not found")
    return typeof r === "string" ? r : JSON.stringify(r, null, 2)
  },
})

simple({
  id: "code:jsonEscape",
  name: "JSON string escape",
  category: CAT,
  description: "Wraps text as a JSON string literal with proper escaping.",
  keywords: ["quote", "stringify"],
  run: (s: string) => JSON.stringify(s),
})
simple({
  id: "code:jsonUnescape",
  name: "JSON string unescape",
  category: CAT,
  description: "Reads a JSON string literal back into plain text.",
  keywords: ["parse", "unquote"],
  run: (s: string) => {
    const v = JSON.parse(s.trim().startsWith('"') ? s : `"${s}"`)
    return String(v)
  },
})

// ---- CSV ----
export function parseCsv(s: string, delim = ","): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let q = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (q) {
      if (c === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++ } else q = false
      } else cell += c
    } else if (c === '"') q = true
    else if (c === delim) { row.push(cell); cell = "" }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++
      row.push(cell); cell = ""
      rows.push(row); row = []
    } else cell += c
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row) }
  return rows
}

const CSV_DELIMS: [string, string][] = [[",", "Comma"], [";", "Semicolon"], ["\t", "Tab"], ["|", "Pipe"]]
simple({
  id: "code:csvToJson",
  name: "CSV to JSON",
  category: CAT,
  description: "Parses CSV (quotes and embedded newlines supported) into a JSON array.",
  keywords: ["table", "spreadsheet", "convert"],
  params: [select("delim", "Delimiter", CSV_DELIMS), toggle("header", "First row is header", true)],
  run: (s: string, p) => {
    const rows = parseCsv(s, str_(p, "delim")).filter((r) => r.length > 1 || r[0] !== "")
    if (!bool_(p, "header")) return JSON.stringify(rows, null, 2)
    const [h, ...rest] = rows
    return JSON.stringify(rest.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ""]))), null, 2)
  },
})

simple({
  id: "code:jsonToCsv",
  name: "JSON to CSV",
  category: CAT,
  description: "Flattens an array of objects (or arrays) into CSV.",
  keywords: ["table", "spreadsheet", "convert"],
  params: [select("delim", "Delimiter", CSV_DELIMS)],
  run: (s: string, p) => {
    const data = JSON.parse(s)
    if (!Array.isArray(data)) throw new Error("Expected a JSON array")
    const d = str_(p, "delim")
    const esc = (v: unknown) => {
      const t = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v)
      return /["\n\r]/.test(t) || t.includes(d) ? `"${t.replace(/"/g, '""')}"` : t
    }
    if (data.length && Array.isArray(data[0])) return data.map((r: unknown[]) => r.map(esc).join(d)).join("\n")
    const keys = [...new Set(data.flatMap((o: object) => Object.keys(o)))]
    return [keys.map(esc).join(d), ...data.map((o: Record<string, unknown>) => keys.map((k) => esc(o[k])).join(d))].join("\n")
  },
})

// ---- YAML (emitter only) ----
function yamlScalar(v: unknown): string {
  if (v === null) return "null"
  if (typeof v === "string") return v === "" || /^[\s>|*&!%@`#,\[\]{}'"?:-]|[:#]\s|\s$|^(true|false|null|yes|no|~|[-+]?[\d.]+)$/i.test(v) || v.includes("\n") ? JSON.stringify(v) : v
  return String(v)
}
function toYaml(v: unknown, ind = 0): string {
  const pad = "  ".repeat(ind)
  if (Array.isArray(v)) {
    if (!v.length) return "[]"
    return v.map((x) => (x && typeof x === "object" && (Array.isArray(x) ? x.length : Object.keys(x).length) ? `${pad}-\n${toYaml(x, ind + 1)}` : `${pad}- ${toYaml(x, 0)}`)).join("\n")
  }
  if (v && typeof v === "object") {
    const e = Object.entries(v)
    if (!e.length) return "{}"
    return e.map(([k, x]) => (x && typeof x === "object" && (Array.isArray(x) ? x.length : Object.keys(x).length) ? `${pad}${yamlScalar(k)}:\n${toYaml(x, ind + 1)}` : `${pad}${yamlScalar(k)}: ${toYaml(x, 0)}`)).join("\n")
  }
  return yamlScalar(v)
}
simple({
  id: "code:jsonToYaml",
  name: "JSON to YAML",
  category: CAT,
  description: "Writes JSON as block-style YAML.",
  keywords: ["convert", "config"],
  run: (s: string) => toYaml(JSON.parse(s)),
})

// ---- markup ----
export function formatXml(src: string, indent = "  "): string {
  const tokens = src.match(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<![^>]*>|<\/?[^>]+>|[^<]+/g) ?? []
  const out: string[] = []
  let depth = 0
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (!t.startsWith("<")) {
      const txt = t.trim()
      if (txt) out.push(indent.repeat(depth) + txt)
      continue
    }
    if (t.startsWith("</")) {
      depth = Math.max(0, depth - 1)
      out.push(indent.repeat(depth) + t)
    } else if (/^<[^!?][^>]*[^/]>$|^<[^!?/]>$/.test(t) && !t.startsWith("<!")) {
      // opening tag: keep short text-only elements on one line
      const next = tokens[i + 1]
      const close = tokens[i + 2]
      if (next && !next.startsWith("<") && close && close.startsWith("</") && next.trim().length < 80 && !next.includes("\n")) {
        out.push(indent.repeat(depth) + t + next.trim() + close)
        i += 2
      } else {
        out.push(indent.repeat(depth) + t)
        depth++
      }
    } else out.push(indent.repeat(depth) + t)
  }
  return out.join("\n")
}

simple({
  id: "code:xmlFormat",
  name: "XML / HTML beautify",
  category: CAT,
  description: "Indents markup by nesting depth. Checks well-formedness in XML mode.",
  keywords: ["format", "pretty", "indent", "prettify", "html", "svg"],
  params: [select("indent", "Indent", [["2", "2 spaces"], ["4", "4 spaces"], ["tab", "Tab"]]), toggle("validate", "Validate as XML", false)],
  run: (s: string, p) => {
    if (bool_(p, "validate")) {
      const doc = new DOMParser().parseFromString(s, "application/xml")
      const err = doc.querySelector("parsererror")
      if (err) throw new Error(err.textContent?.split("\n")[0] ?? "Invalid XML")
    }
    return formatXml(s.replace(/>\s+</g, "><").trim(), p.indent === "tab" ? "\t" : " ".repeat(Number(p.indent)))
  },
})

simple({
  id: "code:xmlMinify",
  name: "XML / HTML minify",
  category: CAT,
  description: "Strips comments and whitespace between tags.",
  keywords: ["compact", "compress"],
  run: (s: string) => s.replace(/<!--[\s\S]*?-->/g, "").replace(/>\s+</g, "><").trim(),
})

simple({
  id: "code:stripTags",
  name: "Strip HTML tags",
  category: CAT,
  description: "Removes tags and decodes the text content.",
  keywords: ["html", "plain text", "remove"],
  run: (s: string) => {
    const doc = new DOMParser().parseFromString(s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ""), "text/html")
    return (doc.body.textContent ?? "").replace(/\n\s*\n\s*\n/g, "\n\n").trim()
  },
})

simple({
  id: "code:cssMinify",
  name: "CSS minify",
  category: CAT,
  description: "Removes comments and whitespace from CSS.",
  keywords: ["compact", "compress", "stylesheet"],
  run: (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*([{}:;,>])\s*/g, "$1").replace(/;}/g, "}").trim(),
})

simple({
  id: "code:cssBeautify",
  name: "CSS beautify",
  category: CAT,
  description: "Puts every declaration on its own line, indented by block depth.",
  keywords: ["format", "pretty", "stylesheet"],
  run: (s: string) => {
    const t = s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").trim()
    let depth = 0
    let out = ""
    for (const ch of t) {
      if (ch === "{") { out += " {\n"; depth++; out += "  ".repeat(depth) }
      else if (ch === "}") { depth = Math.max(0, depth - 1); out = out.replace(/\s+$/, "") + "\n" + "  ".repeat(depth) + "}\n" + "  ".repeat(depth) }
      else if (ch === ";") out += ";\n" + "  ".repeat(depth)
      else out += ch
    }
    return out.replace(/\n\s*\n/g, "\n").replace(/:\s*/g, ": ").trim()
  },
})

simple({
  id: "code:sqlFormat",
  name: "SQL format",
  category: CAT,
  description: "Uppercases keywords and breaks lines at major clauses. Cosmetic only, not a full parser.",
  keywords: ["query", "pretty", "database", "beautify"],
  params: [toggle("upper", "Uppercase keywords", true)],
  run: (s: string, p) => {
    const kws = ["select", "from", "where", "group by", "order by", "having", "limit", "offset", "insert into", "values", "update", "set", "delete from", "left join", "right join", "inner join", "full join", "cross join", "join", "on", "union all", "union", "and", "or", "as", "in", "not", "null", "is", "like", "between", "distinct", "case", "when", "then", "else", "end", "asc", "desc", "create table", "alter table", "drop table", "with"]
    let t = s.replace(/\s+/g, " ").trim()
    const alt = [...kws].sort((a, b) => b.length - a.length).map((k) => k.replace(" ", "\\s+")).join("|")
    t = t.replace(new RegExp(`(?<![\\w'"\`])(${alt})(?![\\w'"\`])`, "gi"), (m) => (bool_(p, "upper") ? m.toUpperCase().replace(/\s+/g, " ") : m))
    t = t.replace(/\s+(FROM|WHERE|GROUP BY|ORDER BY|HAVING|LIMIT|OFFSET|VALUES|SET|LEFT JOIN|RIGHT JOIN|INNER JOIN|FULL JOIN|CROSS JOIN|JOIN|UNION ALL|UNION)\b/gi, "\n$1")
    t = t.replace(/\s+(AND|OR)\s+/g, "\n  $1 ")
    return t
  },
})

simple({
  id: "code:color",
  name: "Colour convert",
  category: CAT,
  description: "Converts a CSS colour (hex, rgb(), hsl()) to hex, RGB and HSL.",
  keywords: ["css", "rgb", "hsl", "hex", "color"],
  run: (s: string) => {
    const t = s.trim().toLowerCase()
    let r = 0, g = 0, b = 0
    let m: RegExpExecArray | null
    if ((m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/.exec(t))) {
      const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1]
      r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4), 16)
    } else if ((m = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(t))) {
      r = +m[1]; g = +m[2]; b = +m[3]
    } else if ((m = /^hsla?\(\s*([\d.]+)(?:deg)?[,\s]+([\d.]+)%[,\s]+([\d.]+)%/.exec(t))) {
      const h = +m[1] / 360, sl = +m[2] / 100, l = +m[3] / 100
      const q = l < 0.5 ? l * (1 + sl) : l + sl - l * sl
      const pp = 2 * l - q
      const f = (x: number) => { x = (x + 1) % 1; return Math.round(1e-9 + 255 * (x < 1 / 6 ? pp + (q - pp) * 6 * x : x < 0.5 ? q : x < 2 / 3 ? pp + (q - pp) * (2 / 3 - x) * 6 : pp)) }
      r = sl === 0 ? Math.round(l * 255) : f(h + 1 / 3); g = sl === 0 ? Math.round(l * 255) : f(h); b = sl === 0 ? Math.round(l * 255) : f(h - 1 / 3)
    } else throw new Error("Unrecognised colour. Try #1a2b3c, rgb(26, 43, 60) or hsl(210, 40%, 17%)")
    const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255
    const l = (mx + mn) / 2
    const d = mx - mn
    let h = 0
    const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
    if (d) {
      if (mx === r / 255) h = ((g - b) / 255 / d + 6) % 6
      else if (mx === g / 255) h = (b - r) / 255 / d + 2
      else h = (r - g) / 255 / d + 4
      h *= 60
    }
    const hex = "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")
    return `${hex}\nrgb(${r}, ${g}, ${b})\nhsl(${Math.round(h)}, ${Math.round(sat * 100)}%, ${Math.round(l * 100)}%)`
  },
})

simple({
  id: "code:humanBytes",
  name: "Humanize bytes",
  category: CAT,
  description: "Formats a byte count as KiB / MiB (binary) or KB / MB (decimal).",
  keywords: ["size", "filesize", "kilobytes", "megabytes", "format"],
  params: [select("base", "Units", [["1024", "Binary (KiB)"], ["1000", "Decimal (KB)"]]), num("places", "Decimals", 2, { min: 0, max: 6 })],
  run: (s: string, p) => {
    let n = Number(s.trim())
    if (Number.isNaN(n)) throw new Error("Not a number")
    const base = Number(p.base)
    const units = base === 1024 ? ["B", "KiB", "MiB", "GiB", "TiB", "PiB"] : ["B", "KB", "MB", "GB", "TB", "PB"]
    let i = 0
    while (Math.abs(n) >= base && i < units.length - 1) { n /= base; i++ }
    return `${i ? n.toFixed(Number(p.places)) : n} ${units[i]}`
  },
})

simple({
  id: "code:semver",
  name: "Parse semver",
  category: CAT,
  description: "Splits a semantic version into major, minor, patch, pre-release and build.",
  keywords: ["version", "package", "release"],
  run: (s: string) => {
    const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/.exec(s.trim())
    if (!m) throw new Error("Not a semantic version")
    return JSON.stringify({ major: +m[1], minor: +m[2], patch: +m[3], prerelease: m[4] ?? null, build: m[5] ?? null }, null, 2)
  },
})

void num
