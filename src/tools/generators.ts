import { base32Encode } from "./codecs"
import { bool_, num, select, text, toggle, tool } from "./kit"

const CAT = "Generators"

function randomInt(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max
  const buf = new Uint32Array(1)
  do crypto.getRandomValues(buf)
  while (buf[0] >= limit)
  return buf[0] % max
}

export function uuidv4(): string {
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function uuidv7(now = Date.now()): string {
  const b = crypto.getRandomValues(new Uint8Array(16))
  let t = BigInt(now)
  for (let i = 5; i >= 0; i--) {
    b[i] = Number(t & 0xffn)
    t >>= 8n
  }
  b[6] = (b[6] & 0x0f) | 0x70
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
export function ulid(now = Date.now()): string {
  let t = now
  let time = ""
  for (let i = 0; i < 10; i++) {
    time = CROCKFORD[t % 32] + time
    t = Math.floor(t / 32)
  }
  let rand = ""
  for (let i = 0; i < 16; i++) rand += CROCKFORD[randomInt(32)]
  return time + rand
}

tool({
  id: "gen:uuid",
  name: "UUID",
  category: CAT,
  description: "Random UUIDs. Version 4 is fully random; version 7 is time-ordered, so it sorts by creation.",
  keywords: ["guid", "identifier", "v4", "v7", "unique id"],
  outputs: [{ id: "out", label: "UUID" }],
  params: [select("version", "Version", ["v4", "v7"]), num("count", "Count", 1, { min: 1, max: 1000 }), toggle("upper", "Uppercase", false), toggle("hyphens", "Hyphens", true)],
  reroll: true,
  run: ({ params }) => {
    const out = Array.from({ length: Number(params.count) }, () => {
      let u = params.version === "v7" ? uuidv7() : uuidv4()
      if (!bool_(params, "hyphens")) u = u.replace(/-/g, "")
      return bool_(params, "upper") ? u.toUpperCase() : u
    })
    return { out: out.join("\n") }
  },
})

tool({
  id: "gen:ulid",
  name: "ULID",
  category: CAT,
  description: "Sortable 26-character identifiers: 48-bit time plus 80 random bits.",
  keywords: ["identifier", "unique id", "sortable"],
  outputs: [{ id: "out", label: "ULID" }],
  params: [num("count", "Count", 1, { min: 1, max: 1000 })],
  reroll: true,
  run: ({ params }) => ({ out: Array.from({ length: Number(params.count) }, () => ulid()).join("\n") }),
})

const SETS = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.<>?/~",
}
tool({
  id: "gen:password",
  name: "Password",
  category: CAT,
  description: "Random passwords from the system's secure generator, with unbiased character selection.",
  keywords: ["random", "secret", "string", "token", "generate"],
  outputs: [{ id: "out", label: "Password" }, { id: "bits", label: "Entropy (bits)", kind: "number" }],
  params: [
    num("length", "Length", 20, { min: 4, max: 256 }),
    num("count", "Count", 1, { min: 1, max: 100 }),
    toggle("lower", "a-z", true),
    toggle("upper", "A-Z", true),
    toggle("digits", "0-9", true),
    toggle("symbols", "Symbols", false),
    toggle("ambiguous", "Exclude look-alikes (0 O l 1 I)", false),
    text("extra", "Extra characters", ""),
  ],
  reroll: true,
  run: ({ params }) => {
    let chars = (["lower", "upper", "digits", "symbols"] as const).filter((k) => bool_(params, k)).map((k) => SETS[k]).join("") + String(params.extra)
    if (bool_(params, "ambiguous")) chars = chars.replace(/[0Ol1I]/g, "")
    chars = [...new Set(chars)].join("")
    if (!chars) throw new Error("No characters to pick from")
    const len = Number(params.length)
    const out = Array.from({ length: Number(params.count) }, () => Array.from({ length: len }, () => chars[randomInt(chars.length)]).join(""))
    return { out: out.join("\n"), bits: Math.round(len * Math.log2(chars.length) * 10) / 10 }
  },
})

tool({
  id: "gen:randomString",
  name: "Random string",
  category: CAT,
  description: "Random strings over a character set you pick: hex, base32, alphanumeric or your own.",
  keywords: ["token", "id", "nonce", "hex", "alphanumeric"],
  outputs: [{ id: "out", label: "String" }],
  params: [
    select("set", "Characters", [["hex", "Hex"], ["alnum", "Alphanumeric"], ["base32", "Base32"], ["urlsafe", "URL-safe (A-Za-z0-9_-)"], ["digits", "Digits"], ["custom", "Custom"]]),
    text("custom", "Custom set", "", { mono: true }),
    num("length", "Length", 32, { min: 1, max: 4096 }),
  ],
  reroll: true,
  run: ({ params }) => {
    const sets: Record<string, string> = {
      hex: "0123456789abcdef",
      alnum: SETS.lower + SETS.upper + SETS.digits,
      base32: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
      urlsafe: SETS.lower + SETS.upper + SETS.digits + "_-",
      digits: SETS.digits,
      custom: [...new Set(String(params.custom))].join(""),
    }
    const chars = sets[String(params.set)]
    if (!chars) throw new Error("Custom character set is empty")
    return { out: Array.from({ length: Number(params.length) }, () => chars[randomInt(chars.length)]).join("") }
  },
})

tool({
  id: "gen:totpSecret",
  name: "TOTP secret",
  category: CAT,
  description: "A random 160-bit Base32 secret, ready for authenticator apps.",
  keywords: ["2fa", "otp", "authenticator", "seed"],
  outputs: [{ id: "out", label: "Secret" }],
  reroll: true,
  run: () => ({ out: base32Encode(crypto.getRandomValues(new Uint8Array(20)), undefined, false) }),
})
