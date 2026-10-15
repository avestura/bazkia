import { bytesToLatin1, fromHexLoose, hexOf, hexdump, latin1ToBytes, toBytes } from "../core/values"
import * as c from "./codecs"
import { DELIMS, bool_, delimiter, num, select, simple, str_, text, toggle } from "./kit"

const CAT = "Data format"
const ENC = "Encoding"

const b64Alphabets = [
  ["std", "Standard (+/)"],
  ["url", "URL safe (-_)"],
] as [string, string][]
const b64 = (a: string) => (a === "url" ? c.B64_URL : c.B64_STD)

simple({
  id: "data:toBase64",
  name: "To Base64",
  category: CAT,
  description: "Encodes bytes as Base64. Pick the URL-safe alphabet for JWTs and filenames.",
  keywords: ["encode", "b64", "base64"],
  input: "bytes",
  params: [select("alphabet", "Alphabet", b64Alphabets), toggle("pad", "Padding", true)],
  run: (b: Uint8Array, p) => c.base64Encode(b, b64(str_(p, "alphabet")), bool_(p, "pad")),
})

simple({
  id: "data:fromBase64",
  name: "From Base64",
  category: CAT,
  description: "Decodes Base64 into bytes. Whitespace and padding are optional; strict mode rejects stray characters.",
  keywords: ["decode", "b64", "base64"],
  output: "bytes",
  params: [select("alphabet", "Alphabet", b64Alphabets), toggle("strict", "Strict", false)],
  run: (s: string, p) => c.base64Decode(s, b64(str_(p, "alphabet")), bool_(p, "strict")),
})

simple({
  id: "data:toBase32",
  name: "To Base32",
  category: CAT,
  description: "Encodes bytes as Base32 (RFC 4648), standard or extended-hex alphabet.",
  keywords: ["encode", "base32"],
  input: "bytes",
  params: [select("alphabet", "Alphabet", [["std", "Standard"], ["hex", "Extended hex"]]), toggle("pad", "Padding", true)],
  run: (b: Uint8Array, p) => c.base32Encode(b, p.alphabet === "hex" ? c.B32_HEX : c.B32_STD, bool_(p, "pad")),
})

simple({
  id: "data:fromBase32",
  name: "From Base32",
  category: CAT,
  description: "Decodes Base32 (RFC 4648).",
  keywords: ["decode", "base32"],
  output: "bytes",
  params: [select("alphabet", "Alphabet", [["std", "Standard"], ["hex", "Extended hex"]])],
  run: (s: string, p) => c.base32Decode(s, p.alphabet === "hex" ? c.B32_HEX : c.B32_STD),
})

simple({
  id: "data:toBase45",
  name: "To Base45",
  category: CAT,
  description: "Encodes bytes as Base45 (RFC 9285), the alphabet used in QR-friendly payloads like EU health certificates.",
  keywords: ["encode", "base45", "qr"],
  input: "bytes",
  run: (b: Uint8Array) => c.base45Encode(b),
})

simple({
  id: "data:fromBase45",
  name: "From Base45",
  category: CAT,
  description: "Decodes Base45 (RFC 9285).",
  keywords: ["decode", "base45"],
  output: "bytes",
  run: (s: string) => c.base45Decode(s),
})

simple({
  id: "data:toBase58",
  name: "To Base58",
  category: CAT,
  description: "Encodes bytes as Base58, as used by Bitcoin addresses.",
  keywords: ["encode", "base58", "bitcoin"],
  input: "bytes",
  params: [select("alphabet", "Alphabet", [["bitcoin", "Bitcoin"], ["flickr", "Flickr"]])],
  run: (b: Uint8Array, p) => c.baseNEncode(b, p.alphabet === "flickr" ? c.B58_FLICKR : c.B58_BITCOIN),
})

simple({
  id: "data:fromBase58",
  name: "From Base58",
  category: CAT,
  description: "Decodes Base58.",
  keywords: ["decode", "base58", "bitcoin"],
  output: "bytes",
  params: [select("alphabet", "Alphabet", [["bitcoin", "Bitcoin"], ["flickr", "Flickr"]])],
  run: (s: string, p) => c.baseNDecode(s.trim(), p.alphabet === "flickr" ? c.B58_FLICKR : c.B58_BITCOIN),
})

simple({
  id: "data:toBase62",
  name: "To Base62",
  category: CAT,
  description: "Encodes bytes as Base62 (0-9, A-Z, a-z).",
  keywords: ["encode", "base62"],
  input: "bytes",
  run: (b: Uint8Array) => c.baseNEncode(b, c.B62),
})

simple({
  id: "data:fromBase62",
  name: "From Base62",
  category: CAT,
  description: "Decodes Base62 (0-9, A-Z, a-z).",
  keywords: ["decode", "base62"],
  output: "bytes",
  run: (s: string) => c.baseNDecode(s.trim(), c.B62),
})

simple({
  id: "data:toBase85",
  name: "To Base85",
  category: CAT,
  description: "Encodes bytes as Ascii85 or Z85.",
  keywords: ["encode", "ascii85", "z85", "base85"],
  input: "bytes",
  params: [select("variant", "Variant", [["ascii85", "Ascii85"], ["z85", "Z85"]])],
  run: (b: Uint8Array, p) => c.base85Encode(b, p.variant as "z85"),
})

simple({
  id: "data:fromBase85",
  name: "From Base85",
  category: CAT,
  description: "Decodes Ascii85 or Z85.",
  keywords: ["decode", "ascii85", "z85", "base85"],
  output: "bytes",
  params: [select("variant", "Variant", [["ascii85", "Ascii85"], ["z85", "Z85"]])],
  run: (s: string, p) => c.base85Decode(s, p.variant as "z85"),
})

// ---- Hex ----
simple({
  id: "data:toHex",
  name: "To Hex",
  category: CAT,
  description: "Writes each byte as two hex digits with an optional delimiter and prefix.",
  keywords: ["encode", "hexadecimal"],
  input: "bytes",
  params: [
    select("delimiter", "Delimiter", DELIMS, "Space"),
    text("prefix", "Prefix", "", { placeholder: "0x" }),
    toggle("upper", "Uppercase", false),
  ],
  run: (b: Uint8Array, p) => {
    const d = delimiter(str_(p, "delimiter"))
    const parts = Array.from(b, (x) => str_(p, "prefix") + x.toString(16).padStart(2, "0"))
    const s = parts.join(d)
    return bool_(p, "upper") ? s.toUpperCase() : s
  },
})

simple({
  id: "data:fromHex",
  name: "From Hex",
  category: CAT,
  description: "Reads hex digits into bytes. Any delimiter, 0x prefix or newline is ignored.",
  keywords: ["decode", "hexadecimal"],
  output: "bytes",
  run: (s: string) => fromHexLoose(s),
})

simple({
  id: "data:toHexdump",
  name: "To Hexdump",
  category: CAT,
  description: "Classic offset / hex / ASCII dump, 16 bytes per line.",
  keywords: ["xxd", "hexdump", "dump"],
  input: "bytes",
  params: [num("width", "Bytes per line", 16, { min: 4, max: 64, step: 4 })],
  run: (b: Uint8Array, p) => hexdump(b, Math.max(1, Number(p.width))),
})

simple({
  id: "data:fromHexdump",
  name: "From Hexdump",
  category: CAT,
  description: "Reads the hex column out of a hexdump, ignoring offsets and the ASCII gutter.",
  keywords: ["xxd", "hexdump", "decode"],
  output: "bytes",
  run: (s: string) => {
    const lines = s.split(/\r?\n/).map((l) => l.replace(/^\s*[0-9a-f]{4,8}:?\s+/i, "").replace(/\|.*\|\s*$/, "").replace(/\s{2,}.*$/, ""))
    return fromHexLoose(lines.join(" "))
  },
})

// ---- Binary / octal / decimal ----
function radixTool(id: string, name: string, radix: number, width: number) {
  simple({
    id: `data:to${id}`,
    name: `To ${name}`,
    category: CAT,
    description: `Writes each byte in ${name.toLowerCase()}.`,
    keywords: ["encode", name.toLowerCase()],
    input: "bytes",
    params: [select("delimiter", "Delimiter", DELIMS, "Space"), toggle("pad", "Zero pad", radix !== 10)],
    run: (b: Uint8Array, p) =>
      Array.from(b, (x) => (bool_(p, "pad") ? x.toString(radix).padStart(width, "0") : x.toString(radix))).join(delimiter(str_(p, "delimiter"))),
  })
  simple({
    id: `data:from${id}`,
    name: `From ${name}`,
    category: CAT,
    description: `Reads ${name.toLowerCase()} numbers (one per byte) back into bytes.`,
    keywords: ["decode", name.toLowerCase()],
    output: "bytes",
    run: (s: string) => {
      const parts = s.split(/[^0-9a-fA-F]+/).filter(Boolean)
      return Uint8Array.from(
        parts.flatMap((t) => {
          if (radix === 2 && t.length > 8 && /^[01]+$/.test(t)) return t.match(/.{1,8}/g)!.map((x) => parseInt(x, 2))
          const n = parseInt(t, radix)
          if (!Number.isFinite(n) || n > 255) throw new Error(`Not a byte: ${t}`)
          return [n]
        }),
      )
    },
  })
}
radixTool("Binary", "Binary", 2, 8)
radixTool("Octal", "Octal", 8, 3)
radixTool("Decimal", "Decimal", 10, 3)

simple({
  id: "data:toCharcode",
  name: "To Charcode",
  category: CAT,
  description: "Writes each Unicode code point as a number in the chosen base.",
  keywords: ["ord", "unicode", "codepoint"],
  params: [select("delimiter", "Delimiter", DELIMS, "Space"), select("base", "Base", ["16", "10", "8", "2"], "16")],
  run: (s: string, p) => Array.from(s, (ch) => ch.codePointAt(0)!.toString(Number(p.base))).join(delimiter(str_(p, "delimiter"))),
})

simple({
  id: "data:fromCharcode",
  name: "From Charcode",
  category: CAT,
  description: "Turns a list of code points back into text.",
  keywords: ["chr", "unicode", "codepoint"],
  params: [select("base", "Base", ["16", "10", "8", "2"], "16")],
  run: (s: string, p) =>
    s
      .split(/[^0-9a-fA-F]+/)
      .filter(Boolean)
      .map((t) => String.fromCodePoint(parseInt(t, Number(p.base))))
      .join(""),
})

// ---- URL ----
simple({
  id: "data:urlEncode",
  name: "URL Encode",
  category: ENC,
  description: "Percent-encodes text. Choose whether to keep URL structure characters like / ? & intact.",
  keywords: ["percent", "uri", "escape"],
  params: [toggle("all", "Encode everything (including / ? & =)", true), toggle("spacePlus", "Space as +", false)],
  run: (s: string, p) => {
    let out = bool_(p, "all") ? encodeURIComponent(s).replace(/[!'()*~]/g, (ch) => "%" + ch.charCodeAt(0).toString(16).toUpperCase()) : encodeURI(s)
    if (bool_(p, "spacePlus")) out = out.replace(/%20/g, "+")
    return out
  },
})

simple({
  id: "data:urlDecode",
  name: "URL Decode",
  category: ENC,
  description: "Decodes percent-encoded text.",
  keywords: ["percent", "uri", "unescape"],
  params: [toggle("plus", "Treat + as space", true)],
  run: (s: string, p) => decodeURIComponent(bool_(p, "plus") ? s.replace(/\+/g, " ") : s),
})

simple({
  id: "data:toPunycode",
  name: "To Punycode",
  category: ENC,
  description: "Encodes Unicode domain labels as Punycode (xn--).",
  keywords: ["idn", "domain", "unicode"],
  params: [toggle("domain", "Treat as domain (per label, xn-- prefix)", true)],
  run: (s: string, p) =>
    bool_(p, "domain")
      ? s.split(".").map((l) => (/[^\x00-\x7f]/.test(l) ? "xn--" + c.punycodeEncode(l) : l)).join(".")
      : c.punycodeEncode(s),
})

simple({
  id: "data:fromPunycode",
  name: "From Punycode",
  category: ENC,
  description: "Decodes Punycode (xn--) domain labels back to Unicode.",
  keywords: ["idn", "domain", "unicode"],
  params: [toggle("domain", "Treat as domain (per label, xn-- prefix)", true)],
  run: (s: string, p) =>
    bool_(p, "domain")
      ? s.trim().split(".").map((l) => (l.toLowerCase().startsWith("xn--") ? c.punycodeDecode(l.slice(4)) : l)).join(".")
      : c.punycodeDecode(s.trim()),
})

simple({
  id: "data:htmlEscape",
  name: "HTML Entities: Encode",
  category: ENC,
  description: "Escapes &, <, >, quotes and optionally every non-ASCII character as an entity.",
  keywords: ["escape", "html", "entity", "xml"],
  params: [select("mode", "Mode", [["minimal", "Only & < > quotes"], ["named", "Named where known"], ["numeric", "Numeric"], ["hex", "Hex"]])],
  run: (s: string, p) => c.htmlEncode(s, p.mode as c.HtmlMode),
})

simple({
  id: "data:htmlUnescape",
  name: "HTML Entities: Decode",
  category: ENC,
  description: "Decodes named, decimal and hex HTML entities.",
  keywords: ["unescape", "html", "entity", "xml"],
  run: (s: string) => c.htmlDecode(s),
})

simple({
  id: "data:toQuotedPrintable",
  name: "To Quoted Printable",
  category: ENC,
  description: "MIME quoted-printable encoding with soft line breaks at 76 columns.",
  keywords: ["mime", "email", "qp"],
  input: "bytes",
  run: (b: Uint8Array) => c.qpEncode(b),
})

simple({
  id: "data:fromQuotedPrintable",
  name: "From Quoted Printable",
  category: ENC,
  description: "Decodes MIME quoted-printable.",
  keywords: ["mime", "email", "qp"],
  output: "bytes",
  run: (s: string) => c.qpDecode(s),
})

simple({
  id: "data:toMorse",
  name: "To Morse Code",
  category: ENC,
  description: "Letters separated by spaces, words by ' / '.",
  keywords: ["telegraph", "dots", "dashes"],
  run: (s: string) => c.morseEncode(s),
})

simple({
  id: "data:fromMorse",
  name: "From Morse Code",
  category: ENC,
  description: "Reads dots and dashes. Words are separated by '/' or new lines.",
  keywords: ["telegraph", "dots", "dashes"],
  run: (s: string) => c.morseDecode(s),
})

simple({
  id: "data:escapeString",
  name: "Escape String",
  category: ENC,
  description: "Escapes backslashes, control characters and quotes as in a source-code string literal.",
  keywords: ["backslash", "literal", "quote"],
  params: [select("quote", "Quote", [['"', "Double"], ["'", "Single"], ["`", "Backtick"]])],
  run: (s: string, p) => c.escapeString(s, str_(p, "quote")),
})

simple({
  id: "data:unescapeString",
  name: "Unescape String",
  category: ENC,
  description: "Resolves \\n, \\t, \\xNN, \\uNNNN, \\u{…} and octal escapes.",
  keywords: ["backslash", "literal", "quote"],
  run: (s: string) => c.unescapeString(s),
})

simple({
  id: "data:unicodeEscape",
  name: "Escape Unicode",
  category: ENC,
  description: "Replaces non-ASCII characters with \\uXXXX or U+XXXX.",
  keywords: ["unicode", "utf", "escape"],
  params: [select("style", "Style", [["\\u", "\\uXXXX"], ["U+", "U+XXXX"]])],
  run: (s: string, p) => c.unicodeEscape(s, p.style as "\\u"),
})

simple({
  id: "data:unicodeUnescape",
  name: "Unescape Unicode",
  category: ENC,
  description: "Resolves \\uXXXX, \\u{…} and U+XXXX into characters.",
  keywords: ["unicode", "utf", "unescape"],
  run: (s: string) => c.unicodeUnescape(s),
})

// ---- Text encodings ----
const LABELS = ["utf-8", "utf-16le", "utf-16be", "iso-8859-1", "windows-1252", "windows-1251", "iso-8859-2", "iso-8859-15", "shift_jis", "euc-jp", "gb18030", "big5", "euc-kr", "koi8-r", "macintosh"]

simple({
  id: "data:decodeText",
  name: "Decode Text",
  category: ENC,
  description: "Interprets bytes in a character encoding (UTF-16, Latin-1, Shift_JIS, …) and returns text.",
  keywords: ["charset", "utf", "latin1", "codepage", "decode"],
  input: "bytes",
  params: [select("encoding", "Encoding", LABELS)],
  run: (b: Uint8Array, p) => new TextDecoder(str_(p, "encoding")).decode(b),
})

simple({
  id: "data:encodeText",
  name: "Encode Text",
  category: ENC,
  description: "Turns text into bytes in UTF-8, UTF-16 or Latin-1.",
  keywords: ["charset", "utf", "latin1", "codepage", "encode"],
  output: "bytes",
  params: [select("encoding", "Encoding", ["utf-8", "utf-16le", "utf-16be", "iso-8859-1"])],
  run: (s: string, p) => {
    const e = str_(p, "encoding")
    if (e === "utf-8") return new TextEncoder().encode(s)
    if (e === "iso-8859-1") return latin1ToBytes(s)
    const out = new Uint8Array(s.length * 2)
    const dv = new DataView(out.buffer)
    for (let i = 0; i < s.length; i++) dv.setUint16(i * 2, s.charCodeAt(i), e === "utf-16le")
    return out
  },
})

simple({
  id: "data:bytesToLatin1",
  name: "Bytes to Latin-1 text",
  category: CAT,
  description: "Maps every byte 1:1 to a character, so binary data can pass through text tools untouched.",
  keywords: ["binary", "raw", "string"],
  input: "bytes",
  run: (b: Uint8Array) => bytesToLatin1(b),
})

simple({
  id: "data:toRawBytes",
  name: "Text to bytes",
  category: CAT,
  description: "Marks text as raw UTF-8 bytes, for tools that care about the distinction.",
  keywords: ["utf8", "raw", "binary"],
  output: "bytes",
  run: (s: string) => toBytes(s),
})

simple({
  id: "data:bytesToHexPreview",
  name: "Bytes to hex line",
  category: CAT,
  description: "Compact continuous lowercase hex, no delimiter.",
  keywords: ["hex", "binary"],
  input: "bytes",
  run: (b: Uint8Array) => hexOf(b),
})
