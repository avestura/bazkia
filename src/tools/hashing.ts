import { argon2id } from "@noble/hashes/argon2.js"
import { blake2b, blake2s } from "@noble/hashes/blake2.js"
import { blake3 } from "@noble/hashes/blake3.js"
import { hkdf } from "@noble/hashes/hkdf.js"
import { hmac } from "@noble/hashes/hmac.js"
import { md5, ripemd160, sha1 } from "@noble/hashes/legacy.js"
import { pbkdf2 } from "@noble/hashes/pbkdf2.js"
import { scrypt } from "@noble/hashes/scrypt.js"
import { sha224, sha256, sha384, sha512, sha512_256 } from "@noble/hashes/sha2.js"
import { keccak_256, keccak_512, sha3_224, sha3_256, sha3_384, sha3_512 } from "@noble/hashes/sha3.js"
import type { CHash } from "@noble/hashes/utils.js"
import { base64Decode, base64Encode } from "./codecs"
import { fromHexLoose, hexOf, toBytes, toText } from "../core/values"
import { area, family, num, select, simple, str_, text, tool, toggle, IN_PORT } from "./kit"

type HashFn = ((data: Uint8Array) => Uint8Array) & CHash

export const HASHES: Record<string, HashFn> = {
  MD5: md5 as unknown as HashFn,
  "SHA-1": sha1 as unknown as HashFn,
  "SHA-224": sha224 as unknown as HashFn,
  "SHA-256": sha256 as unknown as HashFn,
  "SHA-384": sha384 as unknown as HashFn,
  "SHA-512": sha512 as unknown as HashFn,
  "SHA-512/256": sha512_256 as unknown as HashFn,
  "SHA3-224": sha3_224 as unknown as HashFn,
  "SHA3-256": sha3_256 as unknown as HashFn,
  "SHA3-384": sha3_384 as unknown as HashFn,
  "SHA3-512": sha3_512 as unknown as HashFn,
  "Keccak-256": keccak_256 as unknown as HashFn,
  "Keccak-512": keccak_512 as unknown as HashFn,
  RIPEMD160: ripemd160 as unknown as HashFn,
  BLAKE2b: blake2b as unknown as HashFn,
  BLAKE2s: blake2s as unknown as HashFn,
  BLAKE3: blake3 as unknown as HashFn,
}

const CAT = "Hashing"
const FORMATS: [string, string][] = [["hex", "Hex"], ["HEX", "Hex (uppercase)"], ["base64", "Base64"]]

export function formatDigest(d: Uint8Array, fmt: string): string {
  if (fmt === "base64") return base64Encode(d)
  const h = hexOf(d)
  return fmt === "HEX" ? h.toUpperCase() : h
}

family(
  [
    ["MD5", "md5", "128-bit digest. Broken for security; still everywhere for checksums."],
    ["SHA-1", "sha1", "160-bit digest. Collision-broken; used by git and legacy systems."],
    ["SHA-224", "sha224", "SHA-2 family, 224-bit digest."],
    ["SHA-256", "sha256", "SHA-2 family, 256-bit digest. The default choice."],
    ["SHA-384", "sha384", "SHA-2 family, 384-bit digest."],
    ["SHA-512", "sha512", "SHA-2 family, 512-bit digest."],
    ["SHA-512/256", "sha512-256", "SHA-512 truncated to 256 bits with its own IV."],
    ["SHA3-224", "sha3-224", "Keccak-based SHA-3, 224-bit digest."],
    ["SHA3-256", "sha3-256", "Keccak-based SHA-3, 256-bit digest."],
    ["SHA3-384", "sha3-384", "Keccak-based SHA-3, 384-bit digest."],
    ["SHA3-512", "sha3-512", "Keccak-based SHA-3, 512-bit digest."],
    ["Keccak-256", "keccak256", "The original Keccak padding as used by Ethereum."],
    ["Keccak-512", "keccak512", "The original Keccak padding, 512-bit digest."],
    ["RIPEMD160", "ripemd160", "160-bit digest, used in Bitcoin addresses."],
    ["BLAKE2b", "blake2b", "Fast 512-bit hash."],
    ["BLAKE2s", "blake2s", "Fast 256-bit hash for small platforms."],
    ["BLAKE3", "blake3", "Very fast tree hash, 256-bit by default."],
  ] as const,
  ([name, id, description]) =>
    simple({
      id: `hash:${id}`,
      name,
      category: CAT,
      description,
      keywords: ["hash", "digest", "checksum", name.toLowerCase()],
      input: "bytes",
      params: [select("format", "Output", FORMATS)],
      run: (b: Uint8Array, p) => formatDigest(HASHES[name](b), str_(p, "format")),
    }),
)

simple({
  id: "hash:all",
  name: "Hash (all algorithms)",
  category: CAT,
  description: "Computes every supported digest at once, one per line.",
  keywords: ["digests", "compare", "multiple"],
  input: "bytes",
  run: (b: Uint8Array) =>
    Object.entries(HASHES)
      .map(([n, f]) => `${n.padEnd(12)} ${hexOf(f(b))}`)
      .join("\n"),
})

// ---- checksums ----
function reflect(v: number, width: number): number {
  let r = 0
  for (let i = 0; i < width; i++) if (v & (1 << i)) r |= 1 << (width - 1 - i)
  return r >>> 0
}

export function crc(data: Uint8Array, width: number, poly: number, init: number, refin: boolean, refout: boolean, xorout: number): number {
  const mask = width === 32 ? 0xffffffff : (1 << width) - 1
  const top = 1 << (width - 1)
  let reg = init >>> 0
  for (let byte of data) {
    if (refin) byte = reflect(byte, 8)
    reg = (reg ^ ((byte << (width - 8)) >>> 0)) >>> 0
    for (let i = 0; i < 8; i++) reg = (reg & top ? ((reg << 1) ^ poly) >>> 0 : (reg << 1) >>> 0) & mask
  }
  if (refout) reg = reflect(reg, width)
  return ((reg ^ xorout) & mask) >>> 0
}

export const CRCS: Record<string, [width: number, poly: number, init: number, refin: boolean, refout: boolean, xorout: number]> = {
  "CRC-8": [8, 0x07, 0, false, false, 0],
  "CRC-16/ARC": [16, 0x8005, 0, true, true, 0],
  "CRC-16/CCITT-FALSE": [16, 0x1021, 0xffff, false, false, 0],
  "CRC-16/XMODEM": [16, 0x1021, 0, false, false, 0],
  "CRC-16/MODBUS": [16, 0x8005, 0xffff, true, true, 0],
  "CRC-32": [32, 0x04c11db7, 0xffffffff, true, true, 0xffffffff],
  "CRC-32C": [32, 0x1edc6f41, 0xffffffff, true, true, 0xffffffff],
  "CRC-32/BZIP2": [32, 0x04c11db7, 0xffffffff, false, false, 0xffffffff],
  "CRC-32/MPEG-2": [32, 0x04c11db7, 0xffffffff, false, false, 0],
}

simple({
  id: "hash:crc",
  name: "CRC checksum",
  category: CAT,
  description: "Cyclic redundancy checks: CRC-8, the CRC-16 family and CRC-32 variants.",
  keywords: ["crc32", "crc16", "checksum", "zip", "ethernet"],
  input: "bytes",
  params: [select("variant", "Variant", Object.keys(CRCS), "CRC-32")],
  run: (b: Uint8Array, p) => {
    const v = CRCS[str_(p, "variant")]
    return crc(b, ...v).toString(16).padStart(v[0] / 4, "0")
  },
})

simple({
  id: "hash:adler32",
  name: "Adler-32",
  category: CAT,
  description: "The checksum used by zlib.",
  keywords: ["checksum", "zlib"],
  input: "bytes",
  run: (b: Uint8Array) => {
    let a = 1
    let s = 0
    for (const x of b) {
      a = (a + x) % 65521
      s = (s + a) % 65521
    }
    return (((s << 16) | a) >>> 0).toString(16).padStart(8, "0")
  },
})

simple({
  id: "hash:fletcher16",
  name: "Fletcher-16",
  category: CAT,
  description: "Simple position-aware checksum.",
  keywords: ["checksum"],
  input: "bytes",
  run: (b: Uint8Array) => {
    let a = 0
    let s = 0
    for (const x of b) {
      a = (a + x) % 255
      s = (s + a) % 255
    }
    return ((s << 8) | a).toString(16).padStart(4, "0")
  },
})

// ---- keyed ----
const keyFormats: [string, string][] = [["utf8", "UTF-8"], ["hex", "Hex"], ["base64", "Base64"], ["latin1", "Latin-1"]]

export function parseKey(s: string, fmt: string): Uint8Array {
  switch (fmt) {
    case "hex": return fromHexLoose(s)
    case "base64": return base64Decode(s)
    case "latin1": return Uint8Array.from(s, (c) => c.charCodeAt(0) & 255)
    default: return toBytes(s)
  }
}
const KEY = (id = "key", label = "Key") => text(id, label, "", { mono: true })
const KEYFMT = (id = "keyFormat") => select(id, "Key format", keyFormats)

simple({
  id: "hash:hmac",
  name: "HMAC",
  category: CAT,
  description: "Keyed-hash message authentication code.",
  keywords: ["mac", "authentication", "signature", "keyed"],
  input: "bytes",
  params: [
    select("hash", "Hash", ["SHA-256", "SHA-1", "SHA-512", "SHA-384", "SHA-224", "MD5", "SHA3-256", "RIPEMD160", "BLAKE2b"]),
    KEY(),
    KEYFMT(),
    select("format", "Output", FORMATS),
  ],
  run: (b: Uint8Array, p) => formatDigest(hmac(HASHES[str_(p, "hash")], parseKey(str_(p, "key"), str_(p, "keyFormat")), b), str_(p, "format")),
})

simple({
  id: "hash:pbkdf2",
  name: "PBKDF2",
  category: CAT,
  description: "Derives a key from a password. Input is the password.",
  keywords: ["kdf", "password", "derive", "key stretching"],
  input: "bytes",
  output: "bytes",
  params: [
    text("salt", "Salt", "", { mono: true }),
    select("saltFormat", "Salt format", keyFormats),
    num("iterations", "Iterations", 100000, { min: 1, max: 5_000_000 }),
    num("length", "Key length (bytes)", 32, { min: 1, max: 1024 }),
    select("hash", "Hash", ["SHA-256", "SHA-1", "SHA-512", "SHA-384", "MD5"]),
  ],
  run: (b: Uint8Array, p) =>
    pbkdf2(HASHES[str_(p, "hash")], b, parseKey(str_(p, "salt"), str_(p, "saltFormat")), {
      c: Number(p.iterations),
      dkLen: Number(p.length),
    }),
})

simple({
  id: "hash:scrypt",
  name: "scrypt",
  category: CAT,
  description: "Memory-hard password-based key derivation. Input is the password.",
  keywords: ["kdf", "password", "derive"],
  input: "bytes",
  output: "bytes",
  params: [
    text("salt", "Salt", "", { mono: true }),
    select("saltFormat", "Salt format", keyFormats),
    num("N", "N (cost, power of 2)", 16384, { min: 2, max: 1048576 }),
    num("r", "r (block size)", 8, { min: 1, max: 32 }),
    num("p", "p (parallelism)", 1, { min: 1, max: 16 }),
    num("length", "Key length (bytes)", 32, { min: 1, max: 1024 }),
  ],
  run: (b: Uint8Array, p) =>
    scrypt(b, parseKey(str_(p, "salt"), str_(p, "saltFormat")), {
      N: Number(p.N),
      r: Number(p.r),
      p: Number(p.p),
      dkLen: Number(p.length),
    }),
})

simple({
  id: "hash:argon2id",
  name: "Argon2id",
  category: CAT,
  description: "Modern memory-hard password hash. Input is the password. Memory is in KiB.",
  keywords: ["kdf", "password", "derive", "argon2"],
  input: "bytes",
  output: "bytes",
  params: [
    text("salt", "Salt (8+ bytes)", "somesalt", { mono: true }),
    select("saltFormat", "Salt format", keyFormats),
    num("t", "Iterations", 2, { min: 1, max: 64 }),
    num("m", "Memory (KiB)", 19456, { min: 8, max: 262144 }),
    num("p", "Parallelism", 1, { min: 1, max: 16 }),
    num("length", "Key length (bytes)", 32, { min: 4, max: 1024 }),
  ],
  run: (b: Uint8Array, p) =>
    argon2id(b, parseKey(str_(p, "salt"), str_(p, "saltFormat")), {
      t: Number(p.t),
      m: Number(p.m),
      p: Number(p.p),
      dkLen: Number(p.length),
    }),
})

simple({
  id: "hash:hkdf",
  name: "HKDF",
  category: CAT,
  description: "HMAC-based key derivation (RFC 5869). Input is the input keying material.",
  keywords: ["kdf", "derive", "expand", "extract"],
  input: "bytes",
  output: "bytes",
  params: [
    text("salt", "Salt", "", { mono: true }),
    text("info", "Info", "", { mono: true }),
    num("length", "Length (bytes)", 32, { min: 1, max: 8160 }),
    select("hash", "Hash", ["SHA-256", "SHA-512", "SHA-384", "SHA-1"]),
  ],
  run: (b: Uint8Array, p) => hkdf(HASHES[str_(p, "hash")], b, toBytes(str_(p, "salt")), toBytes(str_(p, "info")), Number(p.length)),
})

// ---- analysis ----
simple({
  id: "hash:analyse",
  name: "Analyse hash",
  category: CAT,
  description: "Guesses which algorithms could have produced a hex digest, from its length.",
  keywords: ["identify", "detect", "hash type"],
  run: (s: string) => {
    const h = s.trim().replace(/^0x/i, "")
    if (!/^[0-9a-f]+$/i.test(h)) return "Not a hex string."
    const bits = h.length * 4
    const table: Record<number, string[]> = {
      16: ["CRC-16", "Fletcher-16"],
      32: ["CRC-32", "Adler-32"],
      64: ["CRC-64"],
      128: ["MD5", "MD4", "NTLM", "HAVAL-128"],
      160: ["SHA-1", "RIPEMD-160", "HAS-160"],
      224: ["SHA-224", "SHA3-224", "SHA-512/224"],
      256: ["SHA-256", "SHA3-256", "BLAKE2s", "BLAKE3", "Keccak-256", "SHA-512/256"],
      384: ["SHA-384", "SHA3-384"],
      512: ["SHA-512", "SHA3-512", "BLAKE2b", "Whirlpool"],
    }
    const hits = table[bits]
    return `${bits} bits (${h.length} hex digits)\n` + (hits ? `Candidates: ${hits.join(", ")}` : "No common algorithm with this length.")
  },
})

tool({
  id: "hash:compare",
  name: "Hash compare",
  category: CAT,
  description: "Constant-time comparison of two digests, ignoring case and whitespace. Outputs true or false.",
  keywords: ["verify", "equal", "match", "checksum"],
  inputs: [
    { id: "a", label: "A" },
    { id: "b", label: "B" },
  ],
  outputs: [{ id: "out", label: "Match" }],
  run: ({ inputs }) => {
    const a = toText(inputs.a).replace(/\s/g, "").toLowerCase()
    const b = toText(inputs.b).replace(/\s/g, "").toLowerCase()
    let diff = a.length ^ b.length
    for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
    return { out: diff === 0 && a.length > 0 }
  },
})

void IN_PORT
void area
void toggle
