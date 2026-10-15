import { gunzipSync, inflateSync, unzlibSync } from "fflate"
import { base32Decode, base64Decode, B64_URL, htmlDecode, morseDecode } from "./codecs"
import { rotate } from "./crypto"
import { fromHexLoose, looksLikeText, toBytes, toText } from "../core/values"
import { num, tool, IN_PORT } from "./kit"

type Decoder = [name: string, fn: (b: Uint8Array) => Uint8Array | null]

const text = (b: Uint8Array) => new TextDecoder().decode(b)
const enc = (s: string) => new TextEncoder().encode(s)

const DECODERS: Decoder[] = [
  ["From Base64", (b) => (/^[A-Za-z0-9+/=\s]{8,}$/.test(text(b)) ? base64Decode(text(b)) : null)],
  ["From Base64 (URL safe)", (b) => (/^[A-Za-z0-9_\-=\s]{8,}$/.test(text(b)) && /[-_]/.test(text(b)) ? base64Decode(text(b), B64_URL) : null)],
  ["From Base32", (b) => (/^[A-Z2-7=\s]{8,}$/.test(text(b)) ? base32Decode(text(b)) : null)],
  ["From Hex", (b) => (/^(?:0x)?[0-9a-fA-F\s:,-]{4,}$/.test(text(b)) ? fromHexLoose(text(b).replace(/[:,-]/g, " ")) : null)],
  ["From Binary", (b) => (/^[01\s]{16,}$/.test(text(b)) ? Uint8Array.from((text(b).replace(/\s/g, "").match(/.{8}/g) ?? []).map((x) => parseInt(x, 2))) : null)],
  ["URL Decode", (b) => (/%[0-9a-fA-F]{2}/.test(text(b)) ? enc(decodeURIComponent(text(b))) : null)],
  ["HTML Entities: Decode", (b) => (/&(#\d+|#x[0-9a-f]+|[a-z]+);/i.test(text(b)) ? enc(htmlDecode(text(b))) : null)],
  ["Gunzip", (b) => (b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : null)],
  ["Zlib decompress", (b) => (b[0] === 0x78 ? unzlibSync(b) : null)],
  ["Raw inflate", (b) => inflateSync(b)],
  ["ROT13", (b) => enc(rotate(text(b), 13))],
  ["Reverse", (b) => enc([...text(b)].reverse().join(""))],
  ["From Morse Code", (b) => (/^[.\-\s/]{5,}$/.test(text(b)) ? enc(morseDecode(text(b))) : null)],
]

const COMMON = /\b(the|and|that|have|for|not|with|you|this|but|from|they|his|her|she|will|one|all|would|there|their|what|http|https|www|com|flag|ctf|password|user|name|data|json|true|false|null|function|return)\b/gi

function score(b: Uint8Array): number {
  if (b.length === 0) return -100
  const s = new TextDecoder("utf-8", { fatal: false }).decode(b)
  let printable = 0
  for (const ch of s) {
    const c = ch.codePointAt(0)!
    if ((c >= 32 && c < 127) || c === 9 || c === 10 || c === 13 || c > 160) printable++
  }
  const ratio = printable / [...s].length
  const counts = new Array(256).fill(0)
  for (const x of b) counts[x]++
  let h = 0
  for (const c of counts) if (c) h -= (c / b.length) * Math.log2(c / b.length)
  const words = (s.match(COMMON) ?? []).length
  return ratio * 100 - h * 3 + Math.min(words, 10) * 6 + (looksLikeText(b) ? 10 : -10)
}

interface Candidate {
  bytes: Uint8Array
  path: string[]
  score: number
}

export function magic(input: Uint8Array, depth: number): Candidate[] {
  const start: Candidate = { bytes: input, path: [], score: score(input) }
  const seen = new Set<string>([text(input)])
  const all: Candidate[] = [start]
  let frontier: Candidate[] = [start]
  for (let d = 0; d < depth; d++) {
    const next: Candidate[] = []
    for (const cand of frontier) {
      for (const [name, fn] of DECODERS) {
        let out: Uint8Array | null = null
        try {
          out = fn(cand.bytes)
        } catch {
          out = null
        }
        if (!out || out.length === 0) continue
        const key = text(out)
        if (seen.has(key)) continue
        seen.add(key)
        const c: Candidate = { bytes: out, path: [...cand.path, name], score: score(out) - cand.path.length * 2 }
        next.push(c)
        all.push(c)
      }
    }
    frontier = next.sort((a, b) => b.score - a.score).slice(0, 6)
    if (!frontier.length) break
  }
  return all.sort((a, b) => b.score - a.score)
}

tool({
  id: "analysis:magic",
  name: "Magic (auto-decode)",
  category: "Analysis",
  description:
    "Tries chains of common decoders (Base64, hex, URL, gzip, ROT13 …) and ranks the results by how readable they are. The best guess goes to the first output; the full report to the second.",
  keywords: ["detect", "decode", "identify", "ctf", "cyberchef", "recipe", "auto", "unknown encoding"],
  inputs: [IN_PORT],
  outputs: [
    { id: "best", label: "Best guess", kind: "bytes" },
    { id: "recipe", label: "Recipe" },
    { id: "report", label: "Report" },
  ],
  params: [num("depth", "Max depth", 3, { min: 1, max: 5 })],
  run: ({ inputs, params }) => {
    const results = magic(toBytes(toText(inputs.in).trim()), Number(params.depth))
    const best = results[0]
    const report = results
      .slice(0, 8)
      .map((r, i) => `#${i + 1}  score ${r.score.toFixed(1)}  ${r.path.length ? r.path.join(" → ") : "(input as is)"}\n    ${text(r.bytes).replace(/[^\x20-\x7e]/g, ".").slice(0, 100)}`)
      .join("\n")
    return { best: best.bytes, recipe: best.path.join(" → ") || "(nothing to decode)", report }
  },
})
