import { deflateSync, gunzipSync, gzipSync, inflateSync, unzlibSync, zlibSync, unzipSync, zipSync, decompressSync } from "fflate"
import { hexOf } from "../core/values"
import { num, simple, str_, text } from "./kit"

const CAT = "Compression"
const level = num("level", "Level", 6, { min: 0, max: 9 })

type Lvl = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
const lv = (p: Record<string, string | number | boolean>) => Math.max(0, Math.min(9, Number(p.level))) as Lvl

simple({ id: "zip:gzip", name: "Gzip", category: CAT, description: "Compresses with gzip.", keywords: ["compress", "gz", "deflate"], input: "bytes", output: "bytes", params: [level], run: (b: Uint8Array, p) => gzipSync(b, { level: lv(p) }) })
simple({ id: "zip:gunzip", name: "Gunzip", category: CAT, description: "Decompresses gzip.", keywords: ["decompress", "gz", "inflate"], input: "bytes", output: "bytes", run: (b: Uint8Array) => gunzipSync(b) })
simple({ id: "zip:zlib", name: "Zlib compress", category: CAT, description: "Compresses with zlib (deflate with a 2-byte header and Adler-32).", keywords: ["compress", "deflate"], input: "bytes", output: "bytes", params: [level], run: (b: Uint8Array, p) => zlibSync(b, { level: lv(p) }) })
simple({ id: "zip:unzlib", name: "Zlib decompress", category: CAT, description: "Decompresses zlib data.", keywords: ["decompress", "inflate"], input: "bytes", output: "bytes", run: (b: Uint8Array) => unzlibSync(b) })
simple({ id: "zip:deflate", name: "Raw deflate", category: CAT, description: "Compresses with raw deflate (no header).", keywords: ["compress"], input: "bytes", output: "bytes", params: [level], run: (b: Uint8Array, p) => deflateSync(b, { level: lv(p) }) })
simple({ id: "zip:inflate", name: "Raw inflate", category: CAT, description: "Decompresses raw deflate data.", keywords: ["decompress"], input: "bytes", output: "bytes", run: (b: Uint8Array) => inflateSync(b) })
simple({
  id: "zip:auto",
  name: "Decompress (auto-detect)",
  category: CAT,
  description: "Detects gzip, zlib or raw deflate and decompresses.",
  keywords: ["inflate", "gunzip", "unzip", "detect"],
  input: "bytes",
  output: "bytes",
  run: (b: Uint8Array) => decompressSync(b),
})

simple({
  id: "zip:zipList",
  name: "Zip: list files",
  category: CAT,
  description: "Lists the files inside a ZIP archive with their sizes.",
  keywords: ["archive", "unzip", "contents"],
  input: "bytes",
  run: (b: Uint8Array) => {
    const files = unzipSync(b)
    return Object.entries(files).map(([n, d]) => `${String(d.length).padStart(10)}  ${n}`).join("\n") || "(empty archive)"
  },
})

simple({
  id: "zip:zipExtract",
  name: "Zip: extract file",
  category: CAT,
  description: "Pulls one file out of a ZIP archive by name. Empty name takes the first file.",
  keywords: ["archive", "unzip"],
  input: "bytes",
  output: "bytes",
  params: [text("name", "File name", "", { mono: true })],
  run: (b: Uint8Array, p) => {
    const files = unzipSync(b)
    const name = str_(p, "name") || Object.keys(files)[0]
    if (!files[name]) throw new Error(`No file named "${name}"`)
    return files[name]
  },
})

simple({
  id: "zip:zipCreate",
  name: "Zip: create (single file)",
  category: CAT,
  description: "Wraps the input in a ZIP archive containing one file.",
  keywords: ["archive", "compress"],
  input: "bytes",
  output: "bytes",
  params: [text("name", "File name", "data.bin", { mono: true }), level],
  run: (b: Uint8Array, p) => zipSync({ [str_(p, "name") || "data.bin"]: b }, { level: lv(p) }),
})

simple({
  id: "zip:ratio",
  name: "Compression ratio",
  category: CAT,
  description: "How well the input compresses with gzip. Near 100% suggests already-compressed or random data.",
  keywords: ["size", "entropy", "efficiency"],
  input: "bytes",
  run: (b: Uint8Array) => {
    const z = gzipSync(b, { level: 9 })
    return `${b.length} B -> ${z.length} B (${b.length ? ((z.length / b.length) * 100).toFixed(1) : 0}%)`
  },
})

simple({
  id: "zip:fileType",
  name: "Detect file type",
  category: "Analysis",
  description: "Identifies common formats from their magic bytes.",
  keywords: ["magic", "signature", "mime", "extension", "forensics", "file"],
  input: "bytes",
  run: (b: Uint8Array) => {
    const sigs: [string, string, string, number?][] = [
      ["89504e470d0a1a0a", "PNG image", "image/png"],
      ["ffd8ff", "JPEG image", "image/jpeg"],
      ["474946383761", "GIF image (87a)", "image/gif"],
      ["474946383961", "GIF image (89a)", "image/gif"],
      ["52494646", "RIFF container (WAV, WebP, AVI)", "application/octet-stream"],
      ["25504446", "PDF document", "application/pdf"],
      ["504b0304", "ZIP archive (also DOCX, XLSX, JAR, APK)", "application/zip"],
      ["1f8b08", "Gzip", "application/gzip"],
      ["425a68", "Bzip2", "application/x-bzip2"],
      ["fd377a585a00", "XZ", "application/x-xz"],
      ["377abcaf271c", "7-Zip", "application/x-7z-compressed"],
      ["526172211a07", "RAR", "application/vnd.rar"],
      ["7f454c46", "ELF executable", "application/x-elf"],
      ["4d5a", "Windows PE executable (MZ)", "application/vnd.microsoft.portable-executable"],
      ["cafebabe", "Java class / Mach-O fat binary", "application/java-vm"],
      ["feedface", "Mach-O 32-bit", "application/x-mach-binary"],
      ["cffaedfe", "Mach-O 64-bit", "application/x-mach-binary"],
      ["53514c69746520666f726d6174203300", "SQLite database", "application/vnd.sqlite3"],
      ["494433", "MP3 with ID3 tag", "audio/mpeg"],
      ["4f676753", "Ogg", "audio/ogg"],
      ["664c6143", "FLAC", "audio/flac"],
      ["1a45dfa3", "Matroska / WebM", "video/webm"],
      ["00000018667479", "MP4 (ftyp)", "video/mp4"],
      ["00000020667479", "MP4 (ftyp)", "video/mp4"],
      ["d0cf11e0a1b11ae1", "OLE2 (legacy Office)", "application/x-ole-storage"],
      ["7b5c72746631", "RTF", "application/rtf"],
      ["3c3f786d6c", "XML", "application/xml"],
      ["00010000", "TrueType font", "font/ttf"],
      ["774f4646", "WOFF font", "font/woff"],
      ["774f4632", "WOFF2 font", "font/woff2"],
      ["0061736d", "WebAssembly", "application/wasm"],
      ["2d2d2d2d2d424547494e", "PEM text (BEGIN …)", "application/x-pem-file"],
    ]
    const hex = hexOf(b.subarray(0, 32))
    const hit = sigs.find(([sig]) => hex.startsWith(sig))
    if (hit) return `${hit[1]}\n${hit[2]}`
    if (b.length >= 262 && new TextDecoder().decode(b.subarray(257, 262)) === "ustar") return "tar archive\napplication/x-tar"
    const head = new TextDecoder().decode(b.subarray(0, 64)).trimStart()
    if (/^[\[{]/.test(head)) return "Looks like JSON\napplication/json"
    if (/^<!doctype html|^<html/i.test(head)) return "Looks like HTML\ntext/html"
    if (/^#!/.test(head)) return "Script with shebang\ntext/x-script"
    return "Unknown (no known signature)"
  },
})
