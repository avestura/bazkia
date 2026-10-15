/** Pure encoding helpers shared by tools and tests. */

export const B64_STD = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
export const B64_URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"

export function base64Encode(b: Uint8Array, alphabet = B64_STD, pad = true): string {
  let out = ""
  let i = 0
  for (; i + 2 < b.length; i += 3) {
    const n = (b[i] << 16) | (b[i + 1] << 8) | b[i + 2]
    out += alphabet[n >> 18] + alphabet[(n >> 12) & 63] + alphabet[(n >> 6) & 63] + alphabet[n & 63]
  }
  const rest = b.length - i
  if (rest === 1) {
    const n = b[i] << 16
    out += alphabet[n >> 18] + alphabet[(n >> 12) & 63] + (pad ? "==" : "")
  } else if (rest === 2) {
    const n = (b[i] << 16) | (b[i + 1] << 8)
    out += alphabet[n >> 18] + alphabet[(n >> 12) & 63] + alphabet[(n >> 6) & 63] + (pad ? "=" : "")
  }
  return out
}

export function base64Decode(s: string, alphabet = B64_STD, strict = false): Uint8Array {
  const map = new Map<string, number>()
  for (let i = 0; i < 64; i++) map.set(alphabet[i], i)
  const vals: number[] = []
  for (const c of s) {
    if (c === "=" || /\s/.test(c)) continue
    const v = map.get(c)
    if (v === undefined) {
      if (strict) throw new Error(`Invalid base64 character: ${JSON.stringify(c)}`)
      continue
    }
    vals.push(v)
  }
  if (vals.length % 4 === 1) throw new Error("Invalid base64 length")
  const out: number[] = []
  for (let i = 0; i < vals.length; i += 4) {
    const n = (vals[i] << 18) | ((vals[i + 1] ?? 0) << 12) | ((vals[i + 2] ?? 0) << 6) | (vals[i + 3] ?? 0)
    out.push((n >> 16) & 255)
    if (i + 2 < vals.length) out.push((n >> 8) & 255)
    if (i + 3 < vals.length) out.push(n & 255)
  }
  return Uint8Array.from(out)
}

// ---- Base32 ----
export const B32_STD = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
export const B32_HEX = "0123456789ABCDEFGHIJKLMNOPQRSTUV"

export function base32Encode(b: Uint8Array, alphabet = B32_STD, pad = true): string {
  let out = ""
  let bits = 0
  let acc = 0
  for (const byte of b) {
    acc = (acc << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += alphabet[(acc >>> (bits - 5)) & 31]
      bits -= 5
    }
    acc &= (1 << bits) - 1
  }
  if (bits > 0) out += alphabet[(acc << (5 - bits)) & 31]
  if (pad) while (out.length % 8) out += "="
  return out
}

export function base32Decode(s: string, alphabet = B32_STD): Uint8Array {
  const clean = s.replace(/=+$/, "").replace(/\s/g, "").toUpperCase()
  const out: number[] = []
  let bits = 0
  let acc = 0
  for (const c of clean) {
    const v = alphabet.indexOf(c)
    if (v < 0) throw new Error(`Invalid base32 character: ${JSON.stringify(c)}`)
    acc = (acc << 5) | v
    bits += 5
    if (bits >= 8) {
      out.push((acc >>> (bits - 8)) & 255)
      bits -= 8
      acc &= (1 << bits) - 1
    }
  }
  return Uint8Array.from(out)
}

// ---- Base45 (RFC 9285) ----
export const B45 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:"

export function base45Encode(b: Uint8Array): string {
  let out = ""
  for (let i = 0; i < b.length; i += 2) {
    if (i + 1 < b.length) {
      const n = b[i] * 256 + b[i + 1]
      out += B45[n % 45] + B45[Math.floor(n / 45) % 45] + B45[Math.floor(n / 2025)]
    } else out += B45[b[i] % 45] + B45[Math.floor(b[i] / 45)]
  }
  return out
}

export function base45Decode(s: string): Uint8Array {
  const out: number[] = []
  const vals = [...s.trim()].map((c) => {
    const v = B45.indexOf(c)
    if (v < 0) throw new Error(`Invalid base45 character: ${JSON.stringify(c)}`)
    return v
  })
  for (let i = 0; i < vals.length; i += 3) {
    if (i + 2 < vals.length) {
      const n = vals[i] + vals[i + 1] * 45 + vals[i + 2] * 2025
      if (n > 0xffff) throw new Error("Invalid base45 triplet")
      out.push(n >> 8, n & 255)
    } else if (i + 1 < vals.length) {
      const n = vals[i] + vals[i + 1] * 45
      if (n > 255) throw new Error("Invalid base45 pair")
      out.push(n)
    } else throw new Error("Invalid base45 length")
  }
  return Uint8Array.from(out)
}

// ---- Base58 / Base62: big-number radix conversion that keeps leading zero bytes ----
export const B58_BITCOIN = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
export const B58_FLICKR = "123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ"
export const B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

export function baseNEncode(b: Uint8Array, alphabet: string): string {
  const base = alphabet.length
  let zeros = 0
  while (zeros < b.length && b[zeros] === 0) zeros++
  const digits: number[] = []
  for (let i = zeros; i < b.length; i++) {
    let carry = b[i]
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] * 256
      digits[j] = carry % base
      carry = Math.floor(carry / base)
    }
    while (carry > 0) {
      digits.push(carry % base)
      carry = Math.floor(carry / base)
    }
  }
  return alphabet[0].repeat(zeros) + digits.reverse().map((d) => alphabet[d]).join("")
}

export function baseNDecode(s: string, alphabet: string): Uint8Array {
  const base = alphabet.length
  let zeros = 0
  while (zeros < s.length && s[zeros] === alphabet[0]) zeros++
  const bytes: number[] = []
  for (let i = zeros; i < s.length; i++) {
    const v = alphabet.indexOf(s[i])
    if (v < 0) throw new Error(`Invalid character: ${JSON.stringify(s[i])}`)
    let carry = v
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * base
      bytes[j] = carry & 255
      carry >>= 8
    }
    while (carry > 0) {
      bytes.push(carry & 255)
      carry >>= 8
    }
  }
  return Uint8Array.from([...new Array(zeros).fill(0), ...bytes.reverse()])
}

// ---- Base85 (Ascii85 / Z85) ----
export const Z85 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#"

export function base85Encode(b: Uint8Array, variant: "ascii85" | "z85" = "ascii85"): string {
  let out = ""
  for (let i = 0; i < b.length; i += 4) {
    const chunk = b.subarray(i, i + 4)
    const n = chunk.length
    let v = 0
    for (let j = 0; j < 4; j++) v = v * 256 + (chunk[j] ?? 0)
    if (variant === "ascii85" && n === 4 && v === 0) {
      out += "z"
      continue
    }
    const digs: number[] = []
    for (let j = 0; j < 5; j++) {
      digs.unshift(v % 85)
      v = Math.floor(v / 85)
    }
    const chars = digs.map((d) => (variant === "z85" ? Z85[d] : String.fromCharCode(d + 33)))
    out += chars.slice(0, n + 1).join("")
  }
  return variant === "ascii85" ? `<~${out}~>` : out
}

export function base85Decode(s: string, variant: "ascii85" | "z85" = "ascii85"): Uint8Array {
  let t = s.trim()
  if (variant === "ascii85") t = t.replace(/^<~/, "").replace(/~>$/, "")
  t = t.replace(/\s/g, "")
  const out: number[] = []
  const vals: number[] = []
  const value = (digits: number[]) => digits.reduce((v, d) => v * 85 + d, 0)
  for (const c of t) {
    if (variant === "ascii85" && c === "z" && vals.length === 0) {
      out.push(0, 0, 0, 0)
      continue
    }
    const d = variant === "z85" ? Z85.indexOf(c) : c.charCodeAt(0) - 33
    if (d < 0 || d > 84) throw new Error(`Invalid base85 character: ${JSON.stringify(c)}`)
    vals.push(d)
    if (vals.length === 5) {
      const v = value(vals)
      out.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255)
      vals.length = 0
    }
  }
  if (vals.length) {
    const n = vals.length
    while (vals.length < 5) vals.push(84)
    const v = value(vals)
    out.push(...[(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255].slice(0, n - 1))
  }
  return Uint8Array.from(out)
}

// ---- Punycode (RFC 3492) ----
const BASE = 36
const TMIN = 1
const TMAX = 26
const SKEW = 38
const DAMP = 700
const INITIAL_BIAS = 72
const INITIAL_N = 128

function adapt(delta: number, numPoints: number, first: boolean) {
  let k = 0
  delta = first ? Math.floor(delta / DAMP) : delta >> 1
  delta += Math.floor(delta / numPoints)
  for (; delta > ((BASE - TMIN) * TMAX) >> 1; k += BASE) delta = Math.floor(delta / (BASE - TMIN))
  return Math.floor(k + ((BASE - TMIN + 1) * delta) / (delta + SKEW))
}
const digitToBasic = (d: number) => String.fromCharCode(d + 22 + 75 * Number(d < 26))

export function punycodeEncode(input: string): string {
  const cps = Array.from(input, (c) => c.codePointAt(0)!)
  let out = cps.filter((c) => c < 128).map((c) => String.fromCharCode(c)).join("")
  const b = out.length
  let h = b
  if (b) out += "-"
  let n = INITIAL_N
  let delta = 0
  let bias = INITIAL_BIAS
  while (h < cps.length) {
    let m = Infinity
    for (const c of cps) if (c >= n && c < m) m = c
    delta += (m - n) * (h + 1)
    n = m
    for (const c of cps) {
      if (c < n) delta++
      if (c === n) {
        let q = delta
        for (let k = BASE; ; k += BASE) {
          const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias
          if (q < t) break
          out += digitToBasic(t + ((q - t) % (BASE - t)))
          q = Math.floor((q - t) / (BASE - t))
        }
        out += digitToBasic(q)
        bias = adapt(delta, h + 1, h === b)
        delta = 0
        h++
      }
    }
    delta++
    n++
  }
  return out
}

export function punycodeDecode(input: string): string {
  const out: number[] = []
  let basic = input.lastIndexOf("-")
  if (basic < 0) basic = 0
  for (let j = 0; j < basic; j++) out.push(input.charCodeAt(j))
  let n = INITIAL_N
  let i = 0
  let bias = INITIAL_BIAS
  for (let idx = basic > 0 ? basic + 1 : 0; idx < input.length; ) {
    const oldi = i
    for (let w = 1, k = BASE; ; k += BASE) {
      if (idx >= input.length) throw new Error("Invalid punycode")
      const c = input.charCodeAt(idx++)
      const digit = c - 48 < 10 ? c - 22 : c - 65 < 26 ? c - 65 : c - 97 < 26 ? c - 97 : BASE
      if (digit >= BASE) throw new Error("Invalid punycode digit")
      i += digit * w
      const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias
      if (digit < t) break
      w *= BASE - t
    }
    bias = adapt(i - oldi, out.length + 1, oldi === 0)
    n += Math.floor(i / (out.length + 1))
    i %= out.length + 1
    out.splice(i++, 0, n)
  }
  return String.fromCodePoint(...out)
}

// ---- Morse ----
export const MORSE: Record<string, string> = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....", I: "..", J: ".---",
  K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-",
  U: "..-", V: "...-", W: ".--", X: "-..-", Y: "-.--", Z: "--..",
  "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-", "5": ".....", "6": "-....",
  "7": "--...", "8": "---..", "9": "----.",
  ".": ".-.-.-", ",": "--..--", "?": "..--..", "'": ".----.", "!": "-.-.--", "/": "-..-.", "(": "-.--.",
  ")": "-.--.-", "&": ".-...", ":": "---...", ";": "-.-.-.", "=": "-...-", "+": ".-.-.", "-": "-....-",
  _: "..--.-", '"': ".-..-.", $: "...-..-", "@": ".--.-.",
}
const MORSE_REV = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]))

/** Letters are separated by a space, words by " / ". */
export function morseEncode(s: string): string {
  return s
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => [...w].map((c) => MORSE[c]).filter(Boolean).join(" "))
    .join(" / ")
}

export function morseDecode(s: string): string {
  return s
    .trim()
    .split(/\s*\/\s*|\r?\n/)
    .map((w) =>
      w
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((m) => MORSE_REV[m] ?? "?")
        .join(""),
    )
    .join(" ")
}

// ---- HTML entities ----
const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", copy: "©", reg: "®", trade: "™",
  hellip: "…", mdash: "—", ndash: "–", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", euro: "€",
  pound: "£", yen: "¥", cent: "¢", sect: "§", deg: "°", plusmn: "±", times: "×", divide: "÷",
  laquo: "«", raquo: "»", bull: "•", middot: "·", larr: "←", rarr: "→", uarr: "↑", darr: "↓",
}
const NAMED_REV = Object.fromEntries(Object.entries(NAMED).map(([k, v]) => [v, k]))

export type HtmlMode = "minimal" | "named" | "numeric" | "hex"

export function htmlEncode(s: string, mode: HtmlMode = "minimal"): string {
  let out = ""
  for (const ch of s) {
    const cp = ch.codePointAt(0)!
    const special = "&<>\"'".includes(ch)
    if (!special && !(cp > 126 && mode !== "minimal")) {
      out += ch
      continue
    }
    if (mode === "named" && NAMED_REV[ch]) out += `&${NAMED_REV[ch]};`
    else if (mode === "hex") out += `&#x${cp.toString(16)};`
    else if (mode === "numeric") out += `&#${cp};`
    else if (ch === "&") out += "&amp;"
    else if (ch === "<") out += "&lt;"
    else if (ch === ">") out += "&gt;"
    else if (ch === '"') out += "&quot;"
    else if (ch === "'") out += "&#39;"
    else out += `&#${cp};`
  }
  return out
}

export function htmlDecode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const cp = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      try {
        return String.fromCodePoint(cp)
      } catch {
        return m
      }
    }
    return NAMED[e] ?? NAMED[e.toLowerCase()] ?? m
  })
}

// ---- Quoted-printable ----
export function qpEncode(b: Uint8Array): string {
  let out = ""
  let line = 0
  const push = (t: string) => {
    if (line + t.length > 75) {
      out += "=\r\n"
      line = 0
    }
    out += t
    line += t.length
  }
  for (let i = 0; i < b.length; i++) {
    const c = b[i]
    if (c === 13 && b[i + 1] === 10) {
      out += "\r\n"
      line = 0
      i++
    } else if (c === 10) {
      out += "\n"
      line = 0
    } else if (
      (c >= 33 && c <= 126 && c !== 61) ||
      ((c === 32 || c === 9) && i + 1 < b.length && b[i + 1] !== 10 && b[i + 1] !== 13)
    ) {
      push(String.fromCharCode(c))
    } else push("=" + c.toString(16).toUpperCase().padStart(2, "0"))
  }
  return out
}

export function qpDecode(s: string): Uint8Array {
  const t = s.replace(/=\r?\n/g, "")
  const out: number[] = []
  const enc = new TextEncoder()
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "=" && /^[0-9a-fA-F]{2}$/.test(t.slice(i + 1, i + 3))) {
      out.push(parseInt(t.slice(i + 1, i + 3), 16))
      i += 2
    } else out.push(...enc.encode(t[i]))
  }
  return Uint8Array.from(out)
}

// ---- Escapes ----
export function escapeString(s: string, quote = '"'): string {
  return [...s]
    .map((c) => {
      switch (c) {
        case "\\": return "\\\\"
        case "\n": return "\\n"
        case "\r": return "\\r"
        case "\t": return "\\t"
        case "\b": return "\\b"
        case "\f": return "\\f"
        case "\v": return "\\v"
        case "\0": return "\\0"
        default: return c === quote ? "\\" + c : c
      }
    })
    .join("")
}

export function unescapeString(s: string): string {
  return s.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[0-7]{1,3}|[\s\S])/g, (_, e: string) => {
    switch (e[0]) {
      case "n": return "\n"
      case "r": return "\r"
      case "t": return "\t"
      case "b": return "\b"
      case "f": return "\f"
      case "v": return "\v"
      case "x": return String.fromCharCode(parseInt(e.slice(1), 16))
      case "u": return String.fromCodePoint(parseInt(e[1] === "{" ? e.slice(2, -1) : e.slice(1), 16))
    }
    if (/^[0-7]+$/.test(e)) return String.fromCharCode(parseInt(e, 8))
    return e
  })
}

export function unicodeEscape(s: string, style: "\\u" | "U+" = "\\u"): string {
  let out = ""
  for (const ch of s) {
    const cp = ch.codePointAt(0)!
    if (cp < 128) out += ch
    else if (style === "U+") out += `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`
    else if (cp > 0xffff) out += `\\u{${cp.toString(16)}}`
    else out += `\\u${cp.toString(16).padStart(4, "0")}`
  }
  return out
}

export function unicodeUnescape(s: string): string {
  return s.replace(/\\u\{([0-9a-f]+)\}|\\u([0-9a-f]{4})|U\+([0-9a-f]{4,6})/gi, (_, a, b, c) =>
    String.fromCodePoint(parseInt(a ?? b ?? c, 16)),
  )
}
