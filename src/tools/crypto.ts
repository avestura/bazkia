import { hmac } from "@noble/hashes/hmac.js"
import { sha256, sha384, sha512 } from "@noble/hashes/sha2.js"
import { base64Decode, base64Encode, B64_URL } from "./codecs"
import { concatBytes, hexOf, toBytes, toText } from "../core/values"
import { HASHES, parseKey } from "./hashing"
import { binary, bool_, num, select, simple, str_, text, tool, toggle, area, IN_PORT, OUT_PORT } from "./kit"

const CAT = "Crypto"
const KEY_FORMATS: [string, string][] = [["hex", "Hex"], ["utf8", "UTF-8"], ["base64", "Base64"], ["latin1", "Latin-1"]]

// WebCrypto wants a plain ArrayBuffer-backed view.
const buf = (b: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(b) as Uint8Array<ArrayBuffer>

async function aes(mode: "AES-CBC" | "AES-CTR" | "AES-GCM", encrypt: boolean, data: Uint8Array, key: Uint8Array, iv: Uint8Array, aad: Uint8Array) {
  if (![16, 24, 32].includes(key.length)) throw new Error(`AES key must be 16, 24 or 32 bytes (got ${key.length})`)
  const k = await crypto.subtle.importKey("raw", buf(key), mode, false, [encrypt ? "encrypt" : "decrypt"])
  let alg: AesCbcParams | AesCtrParams | AesGcmParams
  if (mode === "AES-CBC") {
    if (iv.length !== 16) throw new Error(`CBC IV must be 16 bytes (got ${iv.length})`)
    alg = { name: mode, iv: buf(iv) }
  } else if (mode === "AES-CTR") {
    if (iv.length !== 16) throw new Error(`CTR counter block must be 16 bytes (got ${iv.length})`)
    alg = { name: mode, counter: buf(iv), length: 64 }
  } else {
    if (iv.length < 1) throw new Error("GCM nonce must not be empty (12 bytes recommended)")
    alg = { name: mode, iv: buf(iv), additionalData: buf(aad) }
  }
  try {
    const out = await (encrypt ? crypto.subtle.encrypt(alg, k, buf(data)) : crypto.subtle.decrypt(alg, k, buf(data)))
    return new Uint8Array(out)
  } catch {
    throw new Error(encrypt ? "Encryption failed" : "Decryption failed (wrong key, IV, mode or corrupted data)")
  }
}

const aesParams = (withAad: boolean) => [
  select("mode", "Mode", [["AES-CBC", "CBC (PKCS#7)"], ["AES-GCM", "GCM"], ["AES-CTR", "CTR"]]),
  text("key", "Key", "", { mono: true, placeholder: "16, 24 or 32 bytes" }),
  select("keyFormat", "Key format", KEY_FORMATS),
  text("iv", "IV / nonce", "", { mono: true, placeholder: "CBC/CTR 16 bytes, GCM 12" }),
  select("ivFormat", "IV format", KEY_FORMATS),
  ...(withAad ? [text("aad", "GCM additional data", "", { mono: true })] : []),
]

for (const enc of [true, false]) {
  simple({
    id: enc ? "crypto:aesEncrypt" : "crypto:aesDecrypt",
    name: enc ? "AES Encrypt" : "AES Decrypt",
    category: CAT,
    description: enc
      ? "AES in CBC, GCM or CTR mode via the platform crypto API. Input is the plaintext; output is raw ciphertext bytes (GCM appends the tag)."
      : "AES decryption. Input is raw ciphertext bytes, for instance from From Base64 or From Hex.",
    keywords: ["aes", "cipher", enc ? "encrypt" : "decrypt", "symmetric", "gcm", "cbc", "ctr"],
    input: "bytes",
    output: "bytes",
    params: aesParams(true),
    run: (b: Uint8Array, p) =>
      aes(
        str_(p, "mode") as "AES-CBC",
        enc,
        b,
        parseKey(str_(p, "key"), str_(p, "keyFormat")),
        parseKey(str_(p, "iv"), str_(p, "ivFormat")),
        toBytes(str_(p, "aad")),
      ),
  })
}

// ---- classical ciphers ----
const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
const a = "abcdefghijklmnopqrstuvwxyz"

export function rotate(s: string, n: number, opts: { upper?: boolean; lower?: boolean; digits?: boolean } = { upper: true, lower: true }): string {
  const sh = ((n % 26) + 26) % 26
  const dsh = ((n % 10) + 10) % 10
  return [...s]
    .map((c) => {
      if (opts.upper && c >= "A" && c <= "Z") return A[(A.indexOf(c) + sh) % 26]
      if (opts.lower && c >= "a" && c <= "z") return a[(a.indexOf(c) + sh) % 26]
      if (opts.digits && c >= "0" && c <= "9") return String((Number(c) + dsh) % 10)
      return c
    })
    .join("")
}

simple({
  id: "crypto:rot13",
  name: "ROT13",
  category: CAT,
  description: "Rotates letters by 13. Applying it twice gives the original.",
  keywords: ["caesar", "rotate", "cipher"],
  run: (s: string) => rotate(s, 13),
})

simple({
  id: "crypto:rotN",
  name: "Caesar / ROT-N",
  category: CAT,
  description: "Rotates letters (and optionally digits) by any amount. Negative amounts decode.",
  keywords: ["caesar", "rotate", "shift", "cipher"],
  params: [num("amount", "Amount", 3), toggle("upper", "Uppercase", true), toggle("lower", "Lowercase", true), toggle("digits", "Digits", false)],
  run: (s: string, p) => rotate(s, Number(p.amount), { upper: bool_(p, "upper"), lower: bool_(p, "lower"), digits: bool_(p, "digits") }),
})

simple({
  id: "crypto:rot47",
  name: "ROT47",
  category: CAT,
  description: "Rotates every printable ASCII character (33 to 126) by 47.",
  keywords: ["rotate", "cipher"],
  run: (s: string) =>
    [...s].map((c) => {
      const n = c.charCodeAt(0)
      return n >= 33 && n <= 126 ? String.fromCharCode(33 + ((n - 33 + 47) % 94)) : c
    }).join(""),
})

simple({
  id: "crypto:atbash",
  name: "Atbash",
  category: CAT,
  description: "Reverses the alphabet: A becomes Z, B becomes Y.",
  keywords: ["cipher", "mirror"],
  run: (s: string) =>
    [...s].map((c) => (c >= "A" && c <= "Z" ? A[25 - A.indexOf(c)] : c >= "a" && c <= "z" ? a[25 - a.indexOf(c)] : c)).join(""),
})

function vigenere(s: string, key: string, decode: boolean) {
  const k = [...key.toUpperCase()].filter((c) => c >= "A" && c <= "Z").map((c) => A.indexOf(c))
  if (!k.length) throw new Error("Key must contain at least one letter")
  let i = 0
  return [...s]
    .map((c) => {
      const up = c >= "A" && c <= "Z"
      const lo = c >= "a" && c <= "z"
      if (!up && !lo) return c
      const sh = (decode ? -k[i % k.length] : k[i % k.length]) + 26
      i++
      const base = up ? A : a
      return base[(base.indexOf(c) + sh) % 26]
    })
    .join("")
}
for (const decode of [false, true]) {
  simple({
    id: decode ? "crypto:vigenereDecode" : "crypto:vigenereEncode",
    name: decode ? "Vigenère Decode" : "Vigenère Encode",
    category: CAT,
    description: "Polyalphabetic substitution with a repeating keyword. Non-letters pass through.",
    keywords: ["vigenere", "classical", "cipher"],
    params: [text("key", "Key", "KEY")],
    run: (s: string, p) => vigenere(s, str_(p, "key"), decode),
  })
}

const gcd = (x: number, y: number): number => (y ? gcd(y, x % y) : x)
for (const decode of [false, true]) {
  simple({
    id: decode ? "crypto:affineDecode" : "crypto:affineEncode",
    name: decode ? "Affine Decode" : "Affine Encode",
    category: CAT,
    description: "E(x) = (ax + b) mod 26. The multiplier a must be coprime with 26.",
    keywords: ["affine", "classical", "cipher"],
    params: [num("a", "a", 5), num("b", "b", 8)],
    run: (s: string, p) => {
      const x = Number(p.a)
      const y = Number(p.b)
      if (gcd(((x % 26) + 26) % 26, 26) !== 1) throw new Error("a must be coprime with 26")
      let inv = 0
      for (let i = 1; i < 26; i++) if ((((x % 26) + 26) % 26 * i) % 26 === 1) inv = i
      return [...s].map((c) => {
        const base = c >= "A" && c <= "Z" ? A : c >= "a" && c <= "z" ? a : null
        if (!base) return c
        const v = base.indexOf(c)
        const r = decode ? (inv * (v - y + 26 * 26)) % 26 : (x * v + y) % 26
        return base[((r % 26) + 26) % 26]
      }).join("")
    },
  })
}

function railPattern(len: number, rails: number) {
  const idx: number[] = []
  let r = 0
  let dir = 1
  for (let i = 0; i < len; i++) {
    idx.push(r)
    if (rails > 1) {
      if (r === 0) dir = 1
      else if (r === rails - 1) dir = -1
      r += dir
    }
  }
  return idx
}
simple({
  id: "crypto:railFenceEncode",
  name: "Rail Fence Encode",
  category: CAT,
  description: "Writes the message in a zig-zag over N rails and reads off row by row.",
  keywords: ["classical", "transposition", "zigzag"],
  params: [num("rails", "Rails", 3, { min: 2, max: 64 })],
  run: (s: string, p) => {
    const chars = [...s]
    const pat = railPattern(chars.length, Number(p.rails))
    return pat.map((r, i) => [r, i] as const).sort((x, y) => x[0] - y[0] || x[1] - y[1]).map(([, i]) => chars[i]).join("")
  },
})
simple({
  id: "crypto:railFenceDecode",
  name: "Rail Fence Decode",
  category: CAT,
  description: "Reverses the rail fence transposition.",
  keywords: ["classical", "transposition", "zigzag"],
  params: [num("rails", "Rails", 3, { min: 2, max: 64 })],
  run: (s: string, p) => {
    const chars = [...s]
    const pat = railPattern(chars.length, Number(p.rails))
    const order = pat.map((r, i) => [r, i] as const).sort((x, y) => x[0] - y[0] || x[1] - y[1])
    const out: string[] = new Array(chars.length)
    order.forEach(([, i], k) => (out[i] = chars[k]))
    return out.join("")
  },
})

const BACON = (i: number) => i.toString(2).padStart(5, "0").replace(/0/g, "A").replace(/1/g, "B")
simple({
  id: "crypto:baconEncode",
  name: "Bacon Cipher Encode",
  category: CAT,
  description: "Each letter becomes five A/B symbols (26-letter variant).",
  keywords: ["classical", "steganography"],
  run: (s: string) => [...s.toUpperCase()].filter((c) => c >= "A" && c <= "Z").map((c) => BACON(A.indexOf(c))).join(" "),
})
simple({
  id: "crypto:baconDecode",
  name: "Bacon Cipher Decode",
  category: CAT,
  description: "Reads groups of five A/B symbols back into letters.",
  keywords: ["classical", "steganography"],
  run: (s: string) => {
    const t = s.toUpperCase().replace(/[^AB]/g, "")
    return (t.match(/.{1,5}/g) ?? []).filter((g) => g.length === 5).map((g) => A[parseInt(g.replace(/A/g, "0").replace(/B/g, "1"), 2)] ?? "?").join("")
  },
})

simple({
  id: "crypto:a1z26Encode",
  name: "A1Z26 Encode",
  category: CAT,
  description: "Letters to their alphabet position: A=1 … Z=26.",
  keywords: ["numbers", "classical", "alphabet"],
  params: [select("delimiter", "Delimiter", [[" ", "Space"], [",", "Comma"], ["-", "Dash"]])],
  run: (s: string, p) => [...s.toUpperCase()].filter((c) => c >= "A" && c <= "Z").map((c) => A.indexOf(c) + 1).join(str_(p, "delimiter")),
})
simple({
  id: "crypto:a1z26Decode",
  name: "A1Z26 Decode",
  category: CAT,
  description: "Alphabet positions back to letters.",
  keywords: ["numbers", "classical", "alphabet"],
  run: (s: string) => (s.match(/\d+/g) ?? []).map((n) => A[Number(n) - 1] ?? "?").join(""),
})

simple({
  id: "crypto:substitute",
  name: "Substitute",
  category: CAT,
  description: "Maps characters from one alphabet to another, position by position.",
  keywords: ["simple substitution", "classical", "translate", "tr"],
  params: [text("from", "Plain alphabet", A, { mono: true }), text("to", "Cipher alphabet", "QWERTYUIOPASDFGHJKLZXCVBNM", { mono: true })],
  run: (s: string, p) => {
    const f = [...str_(p, "from")]
    const t = [...str_(p, "to")]
    if (f.length !== t.length) throw new Error(`Alphabets differ in length (${f.length} vs ${t.length})`)
    const map = new Map(f.map((c, i) => [c, t[i]]))
    return [...s].map((c) => map.get(c) ?? map.get(c.toUpperCase())?.toLowerCase() ?? c).join("")
  },
})

simple({
  id: "crypto:xor",
  name: "XOR",
  category: "Bitwise",
  description: "XORs every byte with a repeating key.",
  keywords: ["bitwise", "key", "cipher", "stream"],
  input: "bytes",
  output: "bytes",
  params: [text("key", "Key", "", { mono: true }), select("keyFormat", "Key format", KEY_FORMATS, "utf8")],
  run: (b: Uint8Array, p) => {
    const k = parseKey(str_(p, "key"), str_(p, "keyFormat"))
    if (!k.length) return b
    return b.map((x, i) => x ^ k[i % k.length])
  },
})

simple({
  id: "crypto:xorBrute",
  name: "XOR brute force (single byte)",
  category: CAT,
  description: "Tries all 256 single-byte keys and ranks outputs by how English-like they look.",
  keywords: ["bruteforce", "xor", "crack", "ctf"],
  input: "bytes",
  params: [num("top", "Show top", 5, { min: 1, max: 50 })],
  run: (b: Uint8Array, p) => {
    const freq = "etaoin shrdlu"
    const rows = Array.from({ length: 256 }, (_, k) => {
      const out = b.map((x) => x ^ k)
      let score = 0
      for (const c of out) {
        if (c >= 32 && c < 127) score += freq.includes(String.fromCharCode(c).toLowerCase()) ? 3 : 1
        else if (c !== 10 && c !== 13 && c !== 9) score -= 5
      }
      return { k, score, text: new TextDecoder().decode(out).replace(/[^\x20-\x7e]/g, ".") }
    })
    return rows
      .sort((x, y) => y.score - x.score)
      .slice(0, Number(p.top))
      .map((r) => `key 0x${r.k.toString(16).padStart(2, "0")}  score ${r.score}\n  ${r.text.slice(0, 120)}`)
      .join("\n")
  },
})

// ---- JWT ----
const b64u = (b: Uint8Array) => base64Encode(b, B64_URL, false)
const b64uDecode = (s: string) => base64Decode(s.replace(/-/g, "+").replace(/_/g, "/"))

tool({
  id: "crypto:jwtDecode",
  name: "JWT Decode",
  category: CAT,
  description: "Splits a JSON Web Token into header, payload and signature. Does not verify anything.",
  keywords: ["jwt", "token", "bearer", "json web token", "claims"],
  inputs: [IN_PORT],
  outputs: [
    { id: "header", label: "Header" },
    { id: "payload", label: "Payload" },
    { id: "signature", label: "Signature" },
  ],
  run: ({ inputs }) => {
    const parts = toText(inputs.in).trim().replace(/^Bearer\s+/i, "").split(".")
    if (parts.length < 2) throw new Error("Not a JWT: expected header.payload.signature")
    const j = (s: string) => JSON.stringify(JSON.parse(new TextDecoder().decode(b64uDecode(s))), null, 2)
    return { header: j(parts[0]), payload: j(parts[1]), signature: parts[2] ?? "" }
  },
})

tool({
  id: "crypto:jwtSign",
  name: "JWT Sign (HMAC)",
  category: CAT,
  description: "Signs a JSON payload as an HS256 / HS384 / HS512 JWT. Input is the payload JSON.",
  keywords: ["jwt", "token", "sign", "hs256"],
  inputs: [IN_PORT],
  outputs: [OUT_PORT],
  params: [select("alg", "Algorithm", ["HS256", "HS384", "HS512"]), text("secret", "Secret", "secret", { mono: true })],
  run: ({ inputs, params }) => {
    const alg = str_(params, "alg")
    const hash = alg === "HS256" ? sha256 : alg === "HS384" ? sha384 : sha512
    const payload = JSON.stringify(JSON.parse(toText(inputs.in) || "{}"))
    const head = b64u(toBytes(JSON.stringify({ alg, typ: "JWT" })))
    const body = b64u(toBytes(payload))
    const sig = b64u(hmac(hash, toBytes(str_(params, "secret")), toBytes(`${head}.${body}`)))
    return { out: `${head}.${body}.${sig}` }
  },
})

tool({
  id: "crypto:jwtVerify",
  name: "JWT Verify (HMAC)",
  category: CAT,
  description: "Checks an HS256 / HS384 / HS512 signature with a shared secret. Outputs true or false.",
  keywords: ["jwt", "token", "verify", "validate"],
  inputs: [IN_PORT],
  outputs: [{ id: "out", label: "Valid" }],
  params: [text("secret", "Secret", "secret", { mono: true })],
  run: ({ inputs, params }) => {
    const [h, p, s] = toText(inputs.in).trim().split(".")
    if (!h || !p || !s) throw new Error("Not a JWT")
    const alg = JSON.parse(new TextDecoder().decode(b64uDecode(h))).alg as string
    const hash = alg === "HS256" ? sha256 : alg === "HS384" ? sha384 : alg === "HS512" ? sha512 : null
    if (!hash) throw new Error(`Unsupported algorithm: ${alg}`)
    const expected = b64u(hmac(hash, toBytes(str_(params, "secret")), toBytes(`${h}.${p}`)))
    return { out: expected === s }
  },
})

// ---- OTP ----
function hotp(key: Uint8Array, counter: bigint, digits: number, hash: "SHA-1" | "SHA-256" | "SHA-512") {
  const c = new Uint8Array(8)
  new DataView(c.buffer).setBigUint64(0, counter)
  const h = hmac(HASHES[hash], key, c)
  const off = h[h.length - 1] & 15
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3]
  return String(bin % 10 ** digits).padStart(digits, "0")
}
tool({
  id: "crypto:totp",
  name: "TOTP code",
  category: CAT,
  description: "Time-based one-time password (RFC 6238). Input is the Base32 secret. Wire a Clock into 'Time' to keep it live.",
  keywords: ["2fa", "authenticator", "otp", "google authenticator"],
  inputs: [IN_PORT],
  outputs: [OUT_PORT, { id: "remaining", label: "Seconds left", kind: "number" }],
  params: [
    num("period", "Period (s)", 30, { min: 1 }),
    num("digits", "Digits", 6, { min: 6, max: 10 }),
    select("hash", "Hash", ["SHA-1", "SHA-256", "SHA-512"]),
    num("time", "Unix time (0 = now)", 0),
  ],
  live: () => 1000,
  run: ({ inputs, params }) => {
    const secret = toText(inputs.in).replace(/[\s-]/g, "").toUpperCase().replace(/=+$/, "")
    const key = base32(secret)
    const now = Number(params.time) || Math.floor(Date.now() / 1000)
    const period = Number(params.period)
    return {
      out: hotp(key, BigInt(Math.floor(now / period)), Number(params.digits), str_(params, "hash") as "SHA-1"),
      remaining: period - (now % period),
    }
  },
})
function base32(s: string): Uint8Array {
  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  const out: number[] = []
  let bits = 0
  let acc = 0
  for (const c of s) {
    const v = alpha.indexOf(c)
    if (v < 0) throw new Error("Secret is not valid Base32")
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

simple({
  id: "crypto:hotp",
  name: "HOTP code",
  category: CAT,
  description: "Counter-based one-time password (RFC 4226). Input is the Base32 secret.",
  keywords: ["otp", "2fa", "counter"],
  params: [num("counter", "Counter", 0, { min: 0 }), num("digits", "Digits", 6, { min: 6, max: 10 })],
  run: (s: string, p) => hotp(base32(s.replace(/[\s-]/g, "").toUpperCase().replace(/=+$/, "")), BigInt(Math.floor(Number(p.counter))), Number(p.digits), "SHA-1"),
})

binary({
  id: "crypto:constantTimeEq",
  name: "Equal (constant time)",
  category: CAT,
  description: "Compares two values without short-circuiting. Outputs true or false.",
  keywords: ["compare", "equal", "timing"],
  run: (x, y) => {
    let diff = x.length ^ y.length
    for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0)
    return diff === 0
  },
})

void area
void concatBytes
void hexOf
