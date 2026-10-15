import { toBytes, toText } from "../core/values"
import { DELIMS, binary, bool_, delimiter, num, select, simple, str_, text, tool, toggle, area, IN_PORT } from "./kit"

const CAT = "Text"
const RX = "Regex"

const lines = (s: string) => s.split(/\r\n|\r|\n/)

// ---- case ----
const words = (s: string) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)

const CASES: [string, string, (s: string) => string][] = [
  ["upper", "UPPER CASE", (s) => s.toUpperCase()],
  ["lower", "lower case", (s) => s.toLowerCase()],
  ["title", "Title Case", (s) => s.toLowerCase().replace(/(^|[\s\-_])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase())],
  ["sentence", "Sentence case", (s) => s.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase())],
  ["camel", "camelCase", (s) => words(s).map((w, i) => (i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join("")],
  ["pascal", "PascalCase", (s) => words(s).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join("")],
  ["snake", "snake_case", (s) => words(s).map((w) => w.toLowerCase()).join("_")],
  ["constant", "CONSTANT_CASE", (s) => words(s).map((w) => w.toUpperCase()).join("_")],
  ["kebab", "kebab-case", (s) => words(s).map((w) => w.toLowerCase()).join("-")],
  ["dot", "dot.case", (s) => words(s).map((w) => w.toLowerCase()).join(".")],
  ["swap", "sWAP cASE", (s) => [...s].map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join("")],
  ["alternating", "aLtErNaTiNg", (s) => [...s].map((c, i) => (i % 2 ? c.toUpperCase() : c.toLowerCase())).join("")],
  ["slug", "URL slug", (s) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")],
]
for (const [id, label, fn] of CASES) {
  simple({
    id: `text:case:${id}`,
    name: `To ${label}`,
    category: CAT,
    description: `Converts text to ${label}.`,
    keywords: ["case", "convert", "naming", "identifier"],
    run: (s: string) => fn(s),
  })
}

// ---- lines & lists ----
simple({
  id: "text:reverse",
  name: "Reverse",
  category: CAT,
  description: "Reverses the text by character, by word or by line.",
  keywords: ["backwards", "flip"],
  params: [select("by", "By", ["Character", "Word", "Line"])],
  run: (s: string, p) =>
    p.by === "Line" ? lines(s).reverse().join("\n") : p.by === "Word" ? s.split(/(\s+)/).reverse().join("") : [...s].reverse().join(""),
})

simple({
  id: "text:sort",
  name: "Sort lines",
  category: CAT,
  description: "Sorts lines alphabetically, numerically, by length or naturally.",
  keywords: ["order", "alphabetical", "numeric"],
  params: [select("order", "Order", ["Alphabetical", "Case-insensitive", "Natural", "Numeric", "Length", "IP address"]), toggle("reverse", "Reverse", false)],
  run: (s: string, p) => {
    const ls = lines(s)
    const ip = (x: string) => x.split(".").reduce((a, b) => a * 256 + (Number(b) || 0), 0)
    const cmp: Record<string, (a: string, b: string) => number> = {
      Alphabetical: (a, b) => (a < b ? -1 : a > b ? 1 : 0),
      "Case-insensitive": (a, b) => a.toLowerCase().localeCompare(b.toLowerCase()),
      Natural: (a, b) => a.localeCompare(b, undefined, { numeric: true }),
      Numeric: (a, b) => parseFloat(a) - parseFloat(b) || 0,
      Length: (a, b) => a.length - b.length,
      "IP address": (a, b) => ip(a) - ip(b),
    }
    ls.sort(cmp[str_(p, "order")])
    return (bool_(p, "reverse") ? ls.reverse() : ls).join("\n")
  },
})

simple({
  id: "text:unique",
  name: "Unique lines",
  category: CAT,
  description: "Removes duplicate lines, keeping the first of each.",
  keywords: ["dedupe", "distinct", "duplicates"],
  params: [toggle("ignoreCase", "Ignore case", false), toggle("count", "Prefix with count", false)],
  run: (s: string, p) => {
    const seen = new Map<string, { line: string; n: number }>()
    for (const l of lines(s)) {
      const k = bool_(p, "ignoreCase") ? l.toLowerCase() : l
      const e = seen.get(k)
      if (e) e.n++
      else seen.set(k, { line: l, n: 1 })
    }
    return [...seen.values()].map((e) => (bool_(p, "count") ? `${e.n} ${e.line}` : e.line)).join("\n")
  },
})

simple({
  id: "text:filterLines",
  name: "Filter lines",
  category: CAT,
  description: "Keeps (or drops) lines that match a regular expression.",
  keywords: ["grep", "search", "match", "remove"],
  params: [text("pattern", "Pattern", "", { mono: true }), toggle("invert", "Invert (drop matches)", false), toggle("ignoreCase", "Ignore case", false)],
  run: (s: string, p) => {
    const re = new RegExp(str_(p, "pattern"), bool_(p, "ignoreCase") ? "i" : "")
    return lines(s).filter((l) => re.test(l) !== bool_(p, "invert")).join("\n")
  },
})

simple({
  id: "text:head",
  name: "Head / Tail",
  category: CAT,
  description: "Takes the first or last N lines.",
  keywords: ["first", "last", "take", "limit"],
  params: [select("end", "From", ["Start", "End"]), num("count", "Lines", 10, { min: 0 })],
  run: (s: string, p) => {
    const ls = lines(s)
    const n = Number(p.count)
    return (p.end === "End" ? ls.slice(Math.max(0, ls.length - n)) : ls.slice(0, n)).join("\n")
  },
})

simple({
  id: "text:dropLines",
  name: "Drop lines",
  category: CAT,
  description: "Removes the first or last N lines.",
  keywords: ["skip", "remove", "header"],
  params: [select("end", "From", ["Start", "End"]), num("count", "Lines", 1, { min: 0 })],
  run: (s: string, p) => {
    const ls = lines(s)
    const n = Number(p.count)
    return (p.end === "End" ? ls.slice(0, Math.max(0, ls.length - n)) : ls.slice(n)).join("\n")
  },
})

simple({
  id: "text:take",
  name: "Take bytes",
  category: CAT,
  description: "Slices a range out of the input bytes.",
  keywords: ["slice", "substring", "range", "cut"],
  input: "bytes",
  output: "bytes",
  params: [num("offset", "Offset", 0, { min: 0 }), num("length", "Length (0 = rest)", 0, { min: 0 })],
  run: (b: Uint8Array, p) => b.subarray(Number(p.offset), Number(p.length) ? Number(p.offset) + Number(p.length) : undefined),
})

simple({
  id: "text:substring",
  name: "Substring",
  category: CAT,
  description: "Takes characters from a start index; negative indices count from the end.",
  keywords: ["slice", "cut", "range"],
  params: [num("start", "Start", 0), num("length", "Length (0 = rest)", 0, { min: 0 })],
  run: (s: string, p) => {
    const chars = [...s]
    const st = Number(p.start) < 0 ? Math.max(0, chars.length + Number(p.start)) : Number(p.start)
    return chars.slice(st, Number(p.length) ? st + Number(p.length) : undefined).join("")
  },
})

simple({
  id: "text:split",
  name: "Split & join",
  category: CAT,
  description: "Splits on one delimiter and joins with another.",
  keywords: ["delimiter", "separator", "replace", "newline"],
  params: [
    select("split", "Split on", [...DELIMS, "Custom"], "Comma"),
    text("splitCustom", "Custom split", "", { mono: true }),
    select("join", "Join with", [...DELIMS, "Custom"], "Line feed"),
    text("joinCustom", "Custom join", "", { mono: true }),
  ],
  run: (s: string, p) => s.split(delimiter(str_(p, "split"), str_(p, "splitCustom"))).join(delimiter(str_(p, "join"), str_(p, "joinCustom"))),
})

simple({
  id: "text:trim",
  name: "Trim / remove whitespace",
  category: CAT,
  description: "Strips whitespace from the ends, from each line, or everywhere.",
  keywords: ["strip", "spaces", "tabs", "blank"],
  params: [select("mode", "Mode", ["Ends", "Each line", "All whitespace", "Blank lines", "Collapse runs"])],
  run: (s: string, p) => {
    switch (p.mode) {
      case "Each line": return lines(s).map((l) => l.trim()).join("\n")
      case "All whitespace": return s.replace(/\s+/g, "")
      case "Blank lines": return lines(s).filter((l) => l.trim()).join("\n")
      case "Collapse runs": return s.replace(/[ \t]+/g, " ")
      default: return s.trim()
    }
  },
})

simple({
  id: "text:lineNumbers",
  name: "Add line numbers",
  category: CAT,
  description: "Prefixes each line with its number.",
  keywords: ["number", "prefix"],
  params: [num("start", "Start at", 1), text("sep", "Separator", ": ")],
  run: (s: string, p) => {
    const ls = lines(s)
    const w = String(Number(p.start) + ls.length - 1).length
    return ls.map((l, i) => `${String(Number(p.start) + i).padStart(w, " ")}${str_(p, "sep")}${l}`).join("\n")
  },
})

simple({
  id: "text:removeLineNumbers",
  name: "Remove line numbers",
  category: CAT,
  description: "Strips leading numbers like '12: ' or '3. ' from every line.",
  keywords: ["number", "strip"],
  run: (s: string) => lines(s).map((l) => l.replace(/^\s*\d+[.:)\]\-\s]\s?/, "")).join("\n"),
})

simple({
  id: "text:pad",
  name: "Pad lines",
  category: CAT,
  description: "Pads every line to a width.",
  keywords: ["align", "fill", "left", "right"],
  params: [select("side", "Side", ["Left", "Right"]), num("width", "Width", 16, { min: 0 }), text("char", "Pad character", " ")],
  run: (s: string, p) =>
    lines(s)
      .map((l) => (p.side === "Left" ? l.padStart(Number(p.width), str_(p, "char") || " ") : l.padEnd(Number(p.width), str_(p, "char") || " ")))
      .join("\n"),
})

simple({
  id: "text:wrap",
  name: "Word wrap",
  category: CAT,
  description: "Breaks lines at a maximum width on word boundaries.",
  keywords: ["fold", "width", "columns"],
  params: [num("width", "Width", 72, { min: 8 })],
  run: (s: string, p) =>
    lines(s)
      .map((l) => {
        const out: string[] = []
        let cur = ""
        for (const w of l.split(/\s+/)) {
          if (cur && cur.length + 1 + w.length > Number(p.width)) {
            out.push(cur)
            cur = w
          } else cur = cur ? `${cur} ${w}` : w
        }
        out.push(cur)
        return out.join("\n")
      })
      .join("\n"),
})

simple({
  id: "text:repeat",
  name: "Repeat",
  category: CAT,
  description: "Repeats the input N times.",
  keywords: ["duplicate", "multiply"],
  params: [num("count", "Times", 2, { min: 0, max: 100000 }), text("sep", "Separator", "")],
  run: (s: string, p) => Array(Number(p.count)).fill(s).join(str_(p, "sep").replace(/\\n/g, "\n")),
})

binary({
  id: "text:concat",
  name: "Concatenate",
  category: CAT,
  description: "Joins two inputs, with an optional separator between them.",
  keywords: ["merge", "join", "append", "combine"],
  params: [text("sep", "Separator", "")],
  run: (x, y, p) => x + str_(p, "sep").replace(/\\n/g, "\n").replace(/\\t/g, "\t") + y,
})

tool({
  id: "text:template",
  name: "Template",
  category: CAT,
  description: "Fills {a} and {b} in a template with the two inputs.",
  keywords: ["format", "interpolate", "placeholder", "string"],
  inputs: [
    { id: "a", label: "a" },
    { id: "b", label: "b" },
  ],
  outputs: [{ id: "out", label: "Output" }],
  params: [area("template", "Template", "Hello, {a}! You are number {b}.", { rows: 3 })],
  run: ({ inputs, params }) => ({
    out: str_(params, "template").replace(/\{(a|b)\}/g, (_, k: string) => toText(inputs[k])),
  }),
})

// ---- stats ----
simple({
  id: "text:stats",
  name: "Text statistics",
  category: "Analysis",
  description: "Characters, words, lines, sentences and bytes.",
  keywords: ["count", "words", "characters", "wc"],
  run: (s: string) => {
    const chars = [...s].length
    const w = (s.match(/\S+/g) ?? []).length
    const l = s === "" ? 0 : lines(s).length
    const sent = (s.match(/[.!?]+(\s|$)/g) ?? []).length
    return [`Characters  ${chars}`, `Words       ${w}`, `Lines       ${l}`, `Sentences   ${sent}`, `Bytes       ${toBytes(s).length}`].join("\n")
  },
})

simple({
  id: "text:frequency",
  name: "Frequency distribution",
  category: "Analysis",
  description: "How often each character occurs, most common first.",
  keywords: ["histogram", "letters", "count", "cryptanalysis"],
  params: [toggle("ignoreCase", "Ignore case", true), toggle("lettersOnly", "Letters only", false)],
  run: (s: string, p) => {
    const m = new Map<string, number>()
    for (let c of s) {
      if (bool_(p, "ignoreCase")) c = c.toLowerCase()
      if (bool_(p, "lettersOnly") && !/\p{L}/u.test(c)) continue
      m.set(c, (m.get(c) ?? 0) + 1)
    }
    const total = [...m.values()].reduce((a, b) => a + b, 0) || 1
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([c, n]) => `${JSON.stringify(c).padEnd(8)} ${String(n).padStart(6)}  ${((n / total) * 100).toFixed(2).padStart(6)}%  ${"#".repeat(Math.ceil((n / total) * 40))}`)
      .join("\n")
  },
})

simple({
  id: "text:entropy",
  name: "Shannon entropy",
  category: "Analysis",
  description: "Bits of entropy per byte (0 to 8). High values suggest compressed or encrypted data.",
  keywords: ["randomness", "packed", "encrypted", "information"],
  input: "bytes",
  run: (b: Uint8Array) => {
    if (!b.length) return "0"
    const counts = new Array(256).fill(0)
    for (const x of b) counts[x]++
    let h = 0
    for (const c of counts) if (c) h -= (c / b.length) * Math.log2(c / b.length)
    return `${h.toFixed(4)} bits/byte\n${h > 7.5 ? "looks compressed or encrypted" : h > 6 ? "dense, binary-like" : h > 4 ? "typical text or structured data" : "low entropy, highly repetitive"}`
  },
})

simple({
  id: "text:ioc",
  name: "Index of coincidence",
  category: "Analysis",
  description: "Probability that two random letters match. English is about 0.066; random text about 0.038.",
  keywords: ["cryptanalysis", "vigenere", "language"],
  run: (s: string) => {
    const letters = s.toUpperCase().replace(/[^A-Z]/g, "")
    const n = letters.length
    if (n < 2) return "Needs at least two letters"
    const c = new Array(26).fill(0)
    for (const ch of letters) c[ch.charCodeAt(0) - 65]++
    const ic = c.reduce((a, f) => a + f * (f - 1), 0) / (n * (n - 1))
    return `${ic.toFixed(5)}\n${ic > 0.06 ? "monoalphabetic or plain language" : ic < 0.045 ? "likely polyalphabetic or random" : "inconclusive"}`
  },
})

tool({
  id: "text:diff",
  name: "Diff",
  category: "Analysis",
  description: "Line-by-line difference between A and B. Lines only in A start with -, only in B with +.",
  keywords: ["compare", "changes", "patch", "unified"],
  inputs: [
    { id: "a", label: "A" },
    { id: "b", label: "B" },
  ],
  outputs: [
    { id: "out", label: "Diff" },
    { id: "same", label: "Identical", kind: "any" },
  ],
  params: [toggle("ignoreWs", "Ignore whitespace", false), select("by", "Compare by", ["Line", "Word", "Character"])],
  run: ({ inputs, params }) => {
    const split = (s: string) => (params.by === "Character" ? [...s] : params.by === "Word" ? s.split(/(\s+)/).filter(Boolean) : lines(s))
    const norm = (x: string) => (params.ignoreWs ? x.replace(/\s+/g, " ").trim() : x)
    const A = split(toText(inputs.a))
    const B = split(toText(inputs.b))
    const n = A.length
    const m = B.length
    if (n * m > 4_000_000) throw new Error("Inputs are too large to diff")
    const L: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = norm(A[i]) === norm(B[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
    const out: string[] = []
    let i = 0
    let j = 0
    let changed = 0
    const glue = params.by === "Line" ? "\n" : ""
    while (i < n && j < m) {
      if (norm(A[i]) === norm(B[j])) { out.push((params.by === "Line" ? "  " : "") + A[i]); i++; j++ }
      else if (L[i + 1][j] >= L[i][j + 1]) { out.push(`${params.by === "Line" ? "- " : "[-"}${A[i]}${params.by === "Line" ? "" : "-]"}`); i++; changed++ }
      else { out.push(`${params.by === "Line" ? "+ " : "{+"}${B[j]}${params.by === "Line" ? "" : "+}"}`); j++; changed++ }
    }
    while (i < n) { out.push(`${params.by === "Line" ? "- " : "[-"}${A[i++]}${params.by === "Line" ? "" : "-]"}`); changed++ }
    while (j < m) { out.push(`${params.by === "Line" ? "+ " : "{+"}${B[j++]}${params.by === "Line" ? "" : "+}"}`); changed++ }
    return { out: out.join(glue), same: changed === 0 }
  },
})

simple({
  id: "text:lorem",
  name: "Lorem ipsum",
  category: "Generators",
  description: "Placeholder text. The input is ignored.",
  keywords: ["placeholder", "dummy", "filler", "generate"],
  params: [select("unit", "Unit", ["Paragraphs", "Sentences", "Words"]), num("count", "Count", 2, { min: 1, max: 200 })],
  run: (_s, p) => {
    const W = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum".split(" ")
    let seed = 7
    const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647
    const word = () => W[Math.floor(rnd() * W.length)]
    const sentence = () => {
      const n = 6 + Math.floor(rnd() * 9)
      const s = Array.from({ length: n }, word).join(" ")
      return s[0].toUpperCase() + s.slice(1) + "."
    }
    const n = Number(p.count)
    if (p.unit === "Words") return Array.from({ length: n }, word).join(" ")
    if (p.unit === "Sentences") return Array.from({ length: n }, sentence).join(" ")
    return Array.from({ length: n }, () => Array.from({ length: 4 + Math.floor(rnd() * 3) }, sentence).join(" ")).join("\n\n")
  },
})

// ---- regex ----
function flags(p: Record<string, string | number | boolean>, extra = "") {
  return (bool_(p, "ignoreCase") ? "i" : "") + (bool_(p, "multiline") ? "m" : "") + (bool_(p, "dotAll") ? "s" : "") + extra
}
const rxFlags = [toggle("ignoreCase", "Ignore case", false), toggle("multiline", "^ $ match lines", true), toggle("dotAll", ". matches newline", false)]

simple({
  id: "regex:match",
  name: "Regex matches",
  category: RX,
  description: "Lists every match of a pattern, with capture groups.",
  keywords: ["regular expression", "find", "search", "grep", "capture"],
  params: [text("pattern", "Pattern", "\\w+", { mono: true }), ...rxFlags, select("output", "Output", ["Matches", "Matches + groups", "Groups only", "Count"])],
  run: (s: string, p) => {
    const re = new RegExp(str_(p, "pattern"), flags(p, "gd"))
    const ms = [...s.matchAll(re)]
    switch (p.output) {
      case "Count": return String(ms.length)
      case "Groups only": return ms.map((m) => m.slice(1).map((g) => g ?? "").join("\t")).join("\n")
      case "Matches + groups": return ms.map((m, i) => `#${i + 1} @${m.index}: ${m[0]}${m.length > 1 ? "\n" + m.slice(1).map((g, k) => `   $${k + 1} = ${g ?? "(unset)"}`).join("\n") : ""}`).join("\n")
      default: return ms.map((m) => m[0]).join("\n")
    }
  },
})

simple({
  id: "regex:replace",
  name: "Find / Replace",
  category: RX,
  description: "Replaces text. With 'regex' on, the replacement may use $1, $2, $& and so on.",
  keywords: ["substitute", "sed", "regular expression", "rewrite"],
  params: [
    text("find", "Find", "", { mono: true }),
    text("replace", "Replace with", "", { mono: true }),
    toggle("regex", "Regex", false),
    toggle("global", "Replace all", true),
    toggle("ignoreCase", "Ignore case", false),
    toggle("multiline", "^ $ match lines", true),
  ],
  run: (s: string, p) => {
    const find = str_(p, "find")
    if (!find) return s
    const src = bool_(p, "regex") ? find : find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const rep = bool_(p, "regex") ? str_(p, "replace") : str_(p, "replace").replace(/\$/g, "$$$$")
    return s.replace(new RegExp(src, (bool_(p, "global") ? "g" : "") + flags(p)), rep.replace(/\\n/g, "\n").replace(/\\t/g, "\t"))
  },
})

simple({
  id: "regex:test",
  name: "Regex test",
  category: RX,
  description: "Does the pattern match anywhere? Outputs true or false.",
  keywords: ["validate", "check", "is match"],
  params: [text("pattern", "Pattern", "^\\d+$", { mono: true }), ...rxFlags],
  run: (s: string, p) => new RegExp(str_(p, "pattern"), flags(p)).test(s),
})

simple({
  id: "regex:escape",
  name: "Escape regex",
  category: RX,
  description: "Escapes every regex metacharacter so the text matches literally.",
  keywords: ["literal", "quote"],
  run: (s: string) => s.replace(/[.*+?^${}()|[\]\\\/-]/g, "\\$&"),
})

simple({
  id: "regex:split",
  name: "Split by regex",
  category: RX,
  description: "Splits on a pattern and puts each piece on its own line.",
  keywords: ["tokenize", "separate"],
  params: [text("pattern", "Pattern", "[,;]\\s*", { mono: true }), toggle("ignoreCase", "Ignore case", false)],
  run: (s: string, p) => s.split(new RegExp(str_(p, "pattern"), flags(p))).join("\n"),
})

void IN_PORT
