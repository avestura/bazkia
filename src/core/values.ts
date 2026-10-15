import type { Value } from "./types"

const enc = new TextEncoder()
const dec = new TextDecoder("utf-8")

export function toText(v: Value): string {
  if (v === undefined || v === null) return ""
  if (typeof v === "string") return v
  if (v instanceof Uint8Array) return dec.decode(v)
  if (typeof v === "number" || typeof v === "boolean") return String(v)
  return JSON.stringify(v, null, 2)
}

export function toBytes(v: Value): Uint8Array {
  if (v instanceof Uint8Array) return v
  return enc.encode(toText(v))
}

export function toNumber(v: Value, fallback = 0): number {
  if (typeof v === "number") return v
  const n = Number(toText(v).trim())
  return Number.isFinite(n) ? n : fallback
}

export function toBool(v: Value): boolean {
  if (typeof v === "boolean") return v
  const s = toText(v).trim().toLowerCase()
  return s === "true" || s === "1" || s === "yes" || s === "on"
}

export const isBytes = (v: Value): v is Uint8Array => v instanceof Uint8Array

/** True when the bytes are valid UTF-8 without control junk, so they can be shown as text. */
export function looksLikeText(b: Uint8Array): boolean {
  try {
    const s = new TextDecoder("utf-8", { fatal: true }).decode(b)
    // eslint-disable-next-line no-control-regex
    return !/[\u0000-\u0008\u000e-\u001f]/.test(s)
  } catch {
    return false
  }
}

export function hexOf(b: Uint8Array, sep = ""): string {
  let s = ""
  for (let i = 0; i < b.length; i++) s += (i && sep ? sep : "") + b[i].toString(16).padStart(2, "0")
  return s
}

export function fromHexLoose(s: string): Uint8Array {
  const clean = s.replace(/0x/gi, "").replace(/[^0-9a-fA-F]/g, "")
  if (clean.length % 2) throw new Error("Odd number of hex digits")
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return out
}

export function hexdump(b: Uint8Array, width = 16): string {
  const lines: string[] = []
  for (let off = 0; off < b.length; off += width) {
    const chunk = b.subarray(off, off + width)
    const hex = Array.from(chunk, (x) => x.toString(16).padStart(2, "0")).join(" ")
    const ascii = Array.from(chunk, (x) => (x >= 0x20 && x < 0x7f ? String.fromCharCode(x) : ".")).join("")
    lines.push(`${off.toString(16).padStart(8, "0")}  ${hex.padEnd(width * 3 - 1, " ")}  |${ascii}|`)
  }
  return lines.join("\n")
}

/** A short single-line description of a value for node previews. */
export function preview(v: Value, max = 64): string {
  if (v === undefined || v === null) return ""
  if (v instanceof Uint8Array) {
    if (looksLikeText(v)) return clip(toText(v), max)
    return `${v.length} B · ${hexOf(v.subarray(0, 12), " ")}${v.length > 12 ? " …" : ""}`
  }
  return clip(toText(v), max)
}

function clip(s: string, max: number) {
  const one = s.replace(/\s+/g, " ").trim()
  return one.length > max ? one.slice(0, max - 1) + "…" : one
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

export function bytesToLatin1(b: Uint8Array): string {
  let s = ""
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192))
  return s
}

export function latin1ToBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff
  return out
}
