import { toBytes, toText } from "../core/values"
import { bool_, family, num, select, simple, toggle } from "./kit"

const CAT = "Extractors"

const EXTRACTORS: [id: string, name: string, description: string, re: RegExp, keywords?: string[]][] = [
  ["email", "Email addresses", "Finds email addresses.", /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, ["mail", "address"]],
  ["ipv4", "IPv4 addresses", "Finds dotted IPv4 addresses.", /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g, ["ip"]],
  ["ipv6", "IPv6 addresses", "Finds IPv6 addresses.", /\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4}\b|\b(?:[0-9a-f]{1,4}:){1,7}:(?:[0-9a-f]{1,4})?\b/gi, ["ip"]],
  ["url", "URLs", "Finds http, https, ftp and ws URLs.", /\b(?:https?|ftp|wss?):\/\/[^\s"'<>)\]]+/gi, ["link", "href"]],
  ["domain", "Domain names", "Finds hostnames such as example.co.uk.", /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/gi, ["host", "fqdn"]],
  ["mac", "MAC addresses", "Finds colon or dash separated MAC addresses.", /\b[0-9a-f]{2}(?:[:-][0-9a-f]{2}){5}\b/gi, ["ethernet", "hardware"]],
  ["uuid", "UUIDs", "Finds UUIDs.", /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, ["guid"]],
  ["hash", "Hex hashes", "Finds hex strings of common digest lengths (32, 40, 56, 64, 96, 128).", /\b(?:[a-f0-9]{128}|[a-f0-9]{96}|[a-f0-9]{64}|[a-f0-9]{56}|[a-f0-9]{40}|[a-f0-9]{32})\b/gi, ["md5", "sha1", "sha256", "digest"]],
  ["date", "Dates", "Finds ISO (2024-01-31) and slash (31/01/2024) dates.", /\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, ["time", "iso"]],
  ["path", "File paths", "Finds Windows and Unix file paths.", /\b[A-Za-z]:\\(?:[^\\\/:*?"<>|\r\n\s]+\\)*[^\\\/:*?"<>|\r\n\s]*|(?:\/[\w.\-]+){2,}\/?/g, ["directory", "folder"]],
  ["jwt", "JWTs", "Finds JSON Web Tokens.", /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, ["token"]],
  ["base64", "Base64 blobs", "Finds Base64-looking runs of 16 or more characters.", /(?:[A-Za-z0-9+/]{4}){4,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/g, ["b64"]],
  ["hexcolor", "Hex colours", "Finds #rgb and #rrggbb colours.", /#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/gi, ["css", "color"]],
  ["number", "Numbers", "Finds integers and decimals.", /-?\d+(?:\.\d+)?/g, ["digits"]],
  ["hashtag", "Hashtags & mentions", "Finds #tags and @mentions.", /[#@][\p{L}\p{N}_]+/gu, ["twitter", "social"]],
]

family(EXTRACTORS, ([id, name, description, re, keywords]) =>
  simple({
    id: `extract:${id}`,
    name: `Extract ${name}`,
    category: CAT,
    description,
    keywords: ["find", "regex", "scrape", ...(keywords ?? [])],
    params: [toggle("unique", "Unique only", false), toggle("sort", "Sort", false)],
    run: (s: string, p) => {
      let m: string[] = [...(s.match(new RegExp(re.source, re.flags)) ?? [])]
      if (bool_(p, "unique")) m = [...new Set(m)]
      if (bool_(p, "sort")) m = [...m].sort()
      return m.join("\n")
    },
  }),
)

simple({
  id: "extract:strings",
  name: "Extract strings",
  category: CAT,
  description: "Printable runs of characters inside binary data, like the Unix strings tool.",
  keywords: ["ascii", "printable", "binary", "malware", "forensics"],
  input: "bytes",
  params: [num("min", "Minimum length", 4, { min: 2, max: 64 }), select("kind", "Encoding", ["ASCII", "UTF-16LE"])],
  run: (b: Uint8Array, p) => {
    const out: string[] = []
    let cur = ""
    const min = Number(p.min)
    const step = p.kind === "UTF-16LE" ? 2 : 1
    for (let i = 0; i < b.length; i += step) {
      const c = b[i]
      const ok = c >= 32 && c < 127 && (step === 1 || b[i + 1] === 0)
      if (ok) cur += String.fromCharCode(c)
      else {
        if (cur.length >= min) out.push(cur)
        cur = ""
      }
    }
    if (cur.length >= min) out.push(cur)
    return out.join("\n")
  },
})

simple({
  id: "extract:count",
  name: "Count occurrences",
  category: CAT,
  description: "Counts how often a substring occurs.",
  keywords: ["find", "frequency", "tally"],
  params: [{ id: "needle", label: "Find", type: "text", default: "", mono: true }, toggle("ignoreCase", "Ignore case", false)],
  run: (s: string, p) => {
    const n = String(p.needle)
    if (!n) return "0"
    const h = bool_(p, "ignoreCase") ? s.toLowerCase() : s
    const nn = bool_(p, "ignoreCase") ? n.toLowerCase() : n
    return String(h.split(nn).length - 1)
  },
})

void toBytes
void toText
