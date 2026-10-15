import { toNumber, toText } from "../core/values"
import { DELIMS, bool_, delimiter, num, select, simple, str_, text, tool, toggle, IN_PORT, OUT_PORT } from "./kit"

const CAT = "Arithmetic"

/** Safe arithmetic expression evaluator: numbers, + - * / % ** ( ), a few functions and constants. */
export function calc(expr: string): number {
  const src = expr.replace(/\s+/g, "")
  let i = 0
  const fns: Record<string, (...a: number[]) => number> = {
    sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan, ln: Math.log, log: Math.log10, log2: Math.log2,
    exp: Math.exp, floor: Math.floor, ceil: Math.ceil, round: Math.round, trunc: Math.trunc, sign: Math.sign,
    min: Math.min, max: Math.max, pow: Math.pow, hypot: Math.hypot,
  }
  const consts: Record<string, number> = { pi: Math.PI, e: Math.E, tau: Math.PI * 2 }

  function peek() { return src[i] }
  function expectEnd() { if (i < src.length) throw new Error(`Unexpected "${src[i]}" at position ${i + 1}`) }

  function parseExpr(): number {
    let v = parseTerm()
    while (peek() === "+" || peek() === "-") {
      const op = src[i++]
      const r = parseTerm()
      v = op === "+" ? v + r : v - r
    }
    return v
  }
  function parseTerm(): number {
    let v = parseUnary()
    for (;;) {
      if (src.startsWith("**", i)) break
      const ch = peek()
      if (ch === "*" || ch === "/" || ch === "%") {
        i++
        const r = parseUnary()
        v = ch === "*" ? v * r : ch === "/" ? v / r : v % r
      } else break
    }
    return v
  }
  function parseUnary(): number {
    if (peek() === "-") { i++; return -parseUnary() }
    if (peek() === "+") { i++; return parseUnary() }
    return parsePow()
  }
  function parsePow(): number {
    const base = parseAtom()
    if (src.startsWith("**", i) || peek() === "^") {
      i += src.startsWith("**", i) ? 2 : 1
      return Math.pow(base, parseUnary())
    }
    return base
  }
  function parseAtom(): number {
    if (peek() === "(") {
      i++
      const v = parseExpr()
      if (src[i++] !== ")") throw new Error("Missing )")
      return v
    }
    const num = /^(?:0x[0-9a-f]+|0b[01]+|\d+\.?\d*(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?)/i.exec(src.slice(i))
    if (num) {
      i += num[0].length
      return Number(num[0])
    }
    const id = /^[a-z_][a-z0-9_]*/i.exec(src.slice(i))
    if (id) {
      const name = id[0].toLowerCase()
      i += id[0].length
      if (peek() === "(") {
        i++
        const args: number[] = []
        if (peek() !== ")") {
          do args.push(parseExpr())
          while (peek() === "," && ++i)
        }
        if (src[i++] !== ")") throw new Error("Missing )")
        const f = fns[name]
        if (!f) throw new Error(`Unknown function ${name}`)
        return f(...args)
      }
      if (name in consts) return consts[name]
      throw new Error(`Unknown name ${name}`)
    }
    throw new Error(i >= src.length ? "Unexpected end of expression" : `Unexpected "${src[i]}" at position ${i + 1}`)
  }
  const v = parseExpr()
  expectEnd()
  return v
}

simple({
  id: "math:calculator",
  name: "Calculator",
  category: CAT,
  description: "Evaluates an expression: + - * / % ** ( ), sqrt, sin, log, min, max, pi, e. Hex (0xFF) and binary (0b101) literals work.",
  keywords: ["expression", "evaluate", "math"],
  run: (s: string) => {
    const v = calc(s)
    return Number.isInteger(v) ? String(v) : String(+v.toPrecision(15))
  },
})

function numbers(s: string, delim: string): number[] {
  const parts = delim === "" ? s.split(/[\s,;]+/) : s.split(delim)
  const nums = parts.map((x) => x.trim()).filter(Boolean).map(Number)
  if (nums.some((n) => Number.isNaN(n))) throw new Error("Input contains something that is not a number")
  return nums
}
const listParams = [select("delimiter", "Delimiter", ["Auto", ...DELIMS]), text("custom", "", "")].slice(0, 1)
const listDelim = (p: Record<string, string | number | boolean>) => (p.delimiter === "Auto" ? "" : delimiter(str_(p, "delimiter")))
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(+n.toPrecision(15)))

const AGG: [string, string, string, (n: number[]) => number][] = [
  ["sum", "Sum", "Adds up a list of numbers.", (n) => n.reduce((a, b) => a + b, 0)],
  ["product", "Product", "Multiplies a list of numbers.", (n) => n.reduce((a, b) => a * b, 1)],
  ["subtract", "Subtract", "Subtracts every later number from the first.", (n) => n.slice(1).reduce((a, b) => a - b, n[0] ?? 0)],
  ["divide", "Divide", "Divides the first number by every later one.", (n) => n.slice(1).reduce((a, b) => a / b, n[0] ?? 0)],
  ["mean", "Mean", "Arithmetic mean of a list of numbers.", (n) => n.reduce((a, b) => a + b, 0) / n.length],
  [
    "median",
    "Median",
    "Middle value of a sorted list.",
    (n) => {
      const s = [...n].sort((a, b) => a - b)
      const m = s.length >> 1
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
    },
  ],
  [
    "stddev",
    "Standard deviation",
    "Population standard deviation of a list of numbers.",
    (n) => {
      const mu = n.reduce((a, b) => a + b, 0) / n.length
      return Math.sqrt(n.reduce((a, b) => a + (b - mu) ** 2, 0) / n.length)
    },
  ],
  ["min", "Min", "Smallest number in a list.", (n) => Math.min(...n)],
  ["max", "Max", "Largest number in a list.", (n) => Math.max(...n)],
]
for (const [id, name, description, f] of AGG) {
  simple({
    id: `math:${id}`,
    name,
    category: CAT,
    description,
    keywords: ["list", "numbers", "aggregate", "statistics"],
    params: listParams,
    run: (s: string, p) => {
      const n = numbers(s, listDelim(p))
      if (!n.length) throw new Error("No numbers in input")
      return fmt(f(n))
    },
  })
}

tool({
  id: "math:operate",
  name: "Math (A op B)",
  category: CAT,
  description: "Combines two numbers with an operator. Uses BigInt when both are integers, so large values stay exact.",
  keywords: ["add", "subtract", "multiply", "divide", "modulo", "power", "gcd", "plus", "minus"],
  inputs: [
    { id: "a", label: "A", kind: "number" },
    { id: "b", label: "B", kind: "number" },
  ],
  outputs: [{ id: "out", label: "Result", kind: "number" }],
  params: [select("op", "Operator", [["+", "A + B"], ["-", "A − B"], ["*", "A × B"], ["/", "A ÷ B"], ["%", "A mod B"], ["**", "A ^ B"], ["gcd", "gcd(A, B)"], ["min", "min(A, B)"], ["max", "max(A, B)"]])],
  run: ({ inputs, params }) => {
    const sa = toText(inputs.a).trim() || "0"
    const sb = toText(inputs.b).trim() || "0"
    const op = str_(params, "op")
    if (/^-?\d+$/.test(sa) && /^-?\d+$/.test(sb) && op !== "/") {
      const x = BigInt(sa)
      const y = BigInt(sb)
      switch (op) {
        case "+": return { out: (x + y).toString() }
        case "-": return { out: (x - y).toString() }
        case "*": return { out: (x * y).toString() }
        case "%": if (y === 0n) throw new Error("Division by zero"); return { out: (x % y).toString() }
        case "**": if (y < 0n || y > 10000n) throw new Error("Exponent out of range"); return { out: (x ** y).toString() }
        case "min": return { out: (x < y ? x : y).toString() }
        case "max": return { out: (x > y ? x : y).toString() }
        case "gcd": {
          let m = x < 0n ? -x : x
          let n = y < 0n ? -y : y
          while (n) [m, n] = [n, m % n]
          return { out: m.toString() }
        }
      }
    }
    const x = toNumber(sa)
    const y = toNumber(sb)
    const r = op === "+" ? x + y : op === "-" ? x - y : op === "*" ? x * y : op === "/" ? x / y : op === "%" ? x % y : op === "**" ? x ** y : op === "min" ? Math.min(x, y) : op === "max" ? Math.max(x, y) : NaN
    return { out: fmt(r) }
  },
})

tool({
  id: "math:compare",
  name: "Compare (A ? B)",
  category: CAT,
  description: "Compares two values and outputs true or false. Works on numbers and on text.",
  keywords: ["equal", "greater", "less", "condition", "if"],
  inputs: [
    { id: "a", label: "A" },
    { id: "b", label: "B" },
  ],
  outputs: [{ id: "out", label: "Result" }],
  params: [select("op", "Test", [["==", "A = B"], ["!=", "A ≠ B"], ["<", "A < B"], ["<=", "A ≤ B"], [">", "A > B"], [">=", "A ≥ B"], ["contains", "A contains B"], ["startsWith", "A starts with B"]])],
  run: ({ inputs, params }) => {
    const sa = toText(inputs.a)
    const sb = toText(inputs.b)
    const bothNum = sa.trim() !== "" && sb.trim() !== "" && !Number.isNaN(Number(sa)) && !Number.isNaN(Number(sb))
    const x: number | string = bothNum ? Number(sa) : sa
    const y: number | string = bothNum ? Number(sb) : sb
    switch (str_(params, "op")) {
      case "==": return { out: x === y }
      case "!=": return { out: x !== y }
      case "<": return { out: x < y }
      case "<=": return { out: x <= y }
      case ">": return { out: x > y }
      case ">=": return { out: x >= y }
      case "contains": return { out: sa.includes(sb) }
      default: return { out: sa.startsWith(sb) }
    }
  },
})

simple({
  id: "math:changeBase",
  name: "Change base",
  category: CAT,
  description: "Converts an integer between bases 2 to 36, with arbitrary size.",
  keywords: ["radix", "binary", "hex", "octal", "decimal", "convert"],
  params: [num("from", "From base", 10, { min: 2, max: 36 }), num("to", "To base", 16, { min: 2, max: 36 })],
  run: (s: string, p) => {
    const from = BigInt(Number(p.from))
    const to = BigInt(Number(p.to))
    const t = s.trim().toLowerCase().replace(/^0x|^0b|^0o/, "").replace(/[_\s]/g, "")
    if (!t) return ""
    const neg = t.startsWith("-")
    let n = 0n
    for (const ch of neg ? t.slice(1) : t) {
      const d = parseInt(ch, 36)
      if (Number.isNaN(d) || BigInt(d) >= from) throw new Error(`"${ch}" is not a base-${from} digit`)
      n = n * from + BigInt(d)
    }
    if (n === 0n) return "0"
    let out = ""
    while (n > 0n) {
      out = Number(n % to).toString(36) + out
      n /= to
    }
    return (neg ? "-" : "") + out
  },
})

simple({
  id: "math:roundTo",
  name: "Round / format number",
  category: CAT,
  description: "Rounds a number and formats it with thousands separators, if wanted.",
  keywords: ["decimal", "places", "precision", "format"],
  params: [num("places", "Decimal places", 2, { min: 0, max: 20 }), toggle("group", "Thousands separators", false)],
  run: (s: string, p) => {
    const n = Number(s.trim())
    if (Number.isNaN(n)) throw new Error("Not a number")
    return bool_(p, "group")
      ? n.toLocaleString("en-US", { minimumFractionDigits: Number(p.places), maximumFractionDigits: Number(p.places) })
      : n.toFixed(Number(p.places))
  },
})

simple({
  id: "math:luhn",
  name: "Luhn check",
  category: CAT,
  description: "Validates a number with the Luhn algorithm (credit cards, IMEI) and reports the correct check digit.",
  keywords: ["credit card", "imei", "checksum", "validate"],
  run: (s: string) => {
    const d = s.replace(/\D/g, "")
    if (!d) return "No digits"
    const sum = (digits: string, double: boolean) => {
      let t = 0
      for (let i = digits.length - 1; i >= 0; i--) {
        let n = Number(digits[i])
        if (double) {
          n *= 2
          if (n > 9) n -= 9
        }
        t += n
        double = !double
      }
      return t
    }
    const valid = sum(d, false) % 10 === 0
    const check = (10 - (sum(d.slice(0, -1), true) % 10)) % 10
    return `${valid ? "valid" : "invalid"}\nexpected check digit for ${d.slice(0, -1) || "(empty)"}: ${check}`
  },
})

tool({
  id: "math:random",
  name: "Random number",
  category: CAT,
  description: "A uniformly random integer in a range. Press re-roll for another.",
  keywords: ["rng", "dice", "roll", "integer"],
  outputs: [{ id: "out", label: "Number", kind: "number" }],
  params: [num("min", "Min", 1), num("max", "Max", 100)],
  reroll: true,
  run: ({ params }) => {
    const lo = Math.ceil(Number(params.min))
    const hi = Math.floor(Number(params.max))
    if (hi < lo) throw new Error("Max is below min")
    const span = hi - lo + 1
    const r = crypto.getRandomValues(new Uint32Array(1))[0]
    return { out: lo + (r % span) }
  },
})

// ---- bitwise ----
const BIT = "Bitwise"
const KEYFMT = [["utf8", "UTF-8"], ["hex", "Hex"], ["decimal", "Decimal byte"]] as [string, string][]
function keyBytes(k: string, f: string): Uint8Array {
  if (f === "hex") {
    const c = k.replace(/[^0-9a-f]/gi, "")
    return Uint8Array.from(c.match(/../g) ?? [], (x) => parseInt(x, 16))
  }
  if (f === "decimal") return Uint8Array.from(k.split(/[\s,]+/).filter(Boolean), (x) => Number(x) & 255)
  return new TextEncoder().encode(k)
}
for (const [id, name, fn] of [
  ["and", "AND", (x: number, k: number) => x & k],
  ["or", "OR", (x: number, k: number) => x | k],
  ["add", "ADD", (x: number, k: number) => (x + k) & 255],
  ["sub", "SUB", (x: number, k: number) => (x - k) & 255],
] as const) {
  simple({
    id: `bit:${id}`,
    name,
    category: BIT,
    description: `Applies ${name} between every byte and a repeating key.`,
    keywords: ["bitwise", "mask", "key"],
    input: "bytes",
    output: "bytes",
    params: [text("key", "Key", "ff", { mono: true }), select("keyFormat", "Key format", KEYFMT, "hex")],
    run: (b: Uint8Array, p) => {
      const k = keyBytes(str_(p, "key"), str_(p, "keyFormat"))
      if (!k.length) return b
      return b.map((x, i) => fn(x, k[i % k.length]))
    },
  })
}
simple({
  id: "bit:not",
  name: "NOT",
  category: BIT,
  description: "Flips every bit.",
  keywords: ["bitwise", "invert", "complement"],
  input: "bytes",
  output: "bytes",
  run: (b: Uint8Array) => b.map((x) => ~x & 255),
})
for (const [id, name, fn] of [
  ["shl", "Shift left", (x: number, n: number) => (x << n) & 255],
  ["shr", "Shift right", (x: number, n: number) => x >>> n],
  ["rol", "Rotate left", (x: number, n: number) => ((x << n) | (x >> (8 - n))) & 255],
  ["ror", "Rotate right", (x: number, n: number) => ((x >> n) | (x << (8 - n))) & 255],
] as const) {
  simple({
    id: `bit:${id}`,
    name: `${name} (per byte)`,
    category: BIT,
    description: `${name} every byte by N bits.`,
    keywords: ["bitwise", "shift", "rotate"],
    input: "bytes",
    output: "bytes",
    params: [num("amount", "Bits", 1, { min: 0, max: 7 })],
    run: (b: Uint8Array, p) => b.map((x) => fn(x, Number(p.amount) & 7)),
  })
}
simple({
  id: "bit:swapEndian",
  name: "Swap endianness",
  category: BIT,
  description: "Reverses the byte order inside each word.",
  keywords: ["byte order", "little", "big", "word"],
  input: "bytes",
  output: "bytes",
  params: [num("word", "Word length (bytes)", 4, { min: 2, max: 64 })],
  run: (b: Uint8Array, p) => {
    const w = Number(p.word)
    const out = new Uint8Array(b.length)
    for (let i = 0; i < b.length; i += w) {
      const chunk = b.subarray(i, i + w)
      out.set(Uint8Array.from(chunk).reverse(), i)
    }
    return out
  },
})
simple({
  id: "bit:reverseBytes",
  name: "Reverse bytes",
  category: BIT,
  description: "Reverses the whole byte array.",
  keywords: ["backwards", "flip"],
  input: "bytes",
  output: "bytes",
  run: (b: Uint8Array) => Uint8Array.from(b).reverse(),
})

void IN_PORT
void OUT_PORT
