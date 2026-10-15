import { toText } from "../core/values"
import { bool_, num, select, simple, str_, text, tool, toggle, IN_PORT } from "./kit"

const CAT = "Networking"

tool({
  id: "net:parseUrl",
  name: "Parse URL",
  category: CAT,
  description: "Splits a URL into its parts. Each part is its own output, so you can wire them separately.",
  keywords: ["uri", "host", "path", "query", "scheme", "protocol", "parse"],
  inputs: [IN_PORT],
  outputs: [
    { id: "json", label: "All (JSON)" },
    { id: "protocol", label: "Protocol" },
    { id: "host", label: "Host" },
    { id: "port", label: "Port" },
    { id: "path", label: "Path" },
    { id: "query", label: "Query" },
    { id: "hash", label: "Fragment" },
  ],
  run: ({ inputs }) => {
    const raw = toText(inputs.in).trim()
    if (!raw) throw new Error("Empty input")
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`)
    const query: Record<string, string | string[]> = {}
    u.searchParams.forEach((v, k) => {
      const cur = query[k]
      query[k] = cur === undefined ? v : Array.isArray(cur) ? [...cur, v] : [cur, v]
    })
    return {
      json: JSON.stringify(
        {
          protocol: u.protocol.replace(":", ""),
          username: u.username || undefined,
          password: u.password || undefined,
          host: u.hostname,
          port: u.port || undefined,
          path: u.pathname,
          query,
          fragment: u.hash.replace("#", "") || undefined,
        },
        null,
        2,
      ),
      protocol: u.protocol.replace(":", ""),
      host: u.hostname,
      port: u.port,
      path: u.pathname,
      query: u.search.replace(/^\?/, ""),
      hash: u.hash.replace(/^#/, ""),
    }
  },
})

simple({
  id: "net:queryToJson",
  name: "Query string to JSON",
  category: CAT,
  description: "Turns a=1&b=2 (with or without a leading ?) into a JSON object. Repeated keys become arrays.",
  keywords: ["params", "search", "url", "parse"],
  run: (s: string) => {
    const out: Record<string, string | string[]> = {}
    new URLSearchParams(s.trim().replace(/^.*\?/, "")).forEach((v, k) => {
      const cur = out[k]
      out[k] = cur === undefined ? v : Array.isArray(cur) ? [...cur, v] : [cur, v]
    })
    return JSON.stringify(out, null, 2)
  },
})

simple({
  id: "net:jsonToQuery",
  name: "JSON to query string",
  category: CAT,
  description: "Builds a query string from a flat JSON object.",
  keywords: ["params", "url", "serialize"],
  run: (s: string) => {
    const o = JSON.parse(s) as Record<string, unknown>
    const u = new URLSearchParams()
    for (const [k, v] of Object.entries(o)) for (const x of Array.isArray(v) ? v : [v]) u.append(k, String(x))
    return u.toString()
  },
})

simple({
  id: "net:defang",
  name: "Defang URL / IP",
  category: CAT,
  description: "Makes links and IPs inert for safe sharing: http becomes hxxp, dots become [.].",
  keywords: ["ioc", "threat", "safe", "malware"],
  params: [toggle("dots", "Dots", true), toggle("http", "hxxp", true), toggle("colon", "Colon in scheme", true)],
  run: (s: string, p) => {
    let o = s
    if (bool_(p, "http")) o = o.replace(/\bhttp/gi, "hxxp")
    if (bool_(p, "colon")) o = o.replace(/(hxxps?|ftp):\/\//gi, "$1[://]")
    if (bool_(p, "dots")) o = o.replace(/\./g, "[.]")
    return o
  },
})
simple({
  id: "net:fang",
  name: "Fang URL / IP",
  category: CAT,
  description: "Reverses defanging.",
  keywords: ["ioc", "threat", "restore"],
  run: (s: string) => s.replace(/hxxp/gi, "http").replace(/\[:\/\/\]/g, "://").replace(/\[\.\]|\(\.\)/g, ".").replace(/\[at\]/gi, "@"),
})

// ---- IPv4 ----
export function ipv4ToInt(s: string): number {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s.trim())
  if (!m || m.slice(1).some((x) => Number(x) > 255)) throw new Error(`Not an IPv4 address: ${s.trim()}`)
  return ((Number(m[1]) << 24) | (Number(m[2]) << 16) | (Number(m[3]) << 8) | Number(m[4])) >>> 0
}
export const intToIpv4 = (n: number) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".")

simple({
  id: "net:ipFormat",
  name: "IPv4 formats",
  category: CAT,
  description: "Converts between dotted, decimal, hex, octal and binary IPv4 notation. Accepts any of them.",
  keywords: ["ip address", "convert", "integer", "dotted"],
  params: [select("to", "Output", ["Dotted", "Decimal", "Hex", "Binary", "All"])],
  run: (s: string, p) => {
    const t = s.trim()
    let n: number
    if (t.includes(".")) n = ipv4ToInt(t)
    else {
      n = t.toLowerCase().startsWith("0x") ? parseInt(t, 16) : t.toLowerCase().startsWith("0b") ? parseInt(t.slice(2), 2) : Number(t)
      if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) throw new Error("Out of IPv4 range")
    }
    const f = {
      Dotted: intToIpv4(n),
      Decimal: String(n),
      Hex: "0x" + n.toString(16).padStart(8, "0"),
      Binary: intToIpv4(n).split(".").map((o) => Number(o).toString(2).padStart(8, "0")).join("."),
    }
    return p.to === "All" ? Object.entries(f).map(([k, v]) => `${k.padEnd(8)} ${v}`).join("\n") : f[p.to as keyof typeof f]
  },
})

simple({
  id: "net:cidr",
  name: "CIDR range",
  category: CAT,
  description: "Network address, broadcast, mask, first and last host and host count for a CIDR like 192.168.1.0/24.",
  keywords: ["subnet", "netmask", "ip range", "network", "broadcast"],
  run: (s: string) => {
    const [ip, bitsRaw] = s.trim().split("/")
    const bits = Number(bitsRaw ?? 32)
    if (!Number.isInteger(bits) || bits < 0 || bits > 32) throw new Error("Prefix must be 0 to 32")
    const addr = ipv4ToInt(ip)
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
    const net = (addr & mask) >>> 0
    const bc = (net | (~mask >>> 0)) >>> 0
    const hosts = bits >= 31 ? 2 ** (32 - bits) : 2 ** (32 - bits) - 2
    return [
      `Network     ${intToIpv4(net)}/${bits}`,
      `Netmask     ${intToIpv4(mask)}`,
      `Wildcard    ${intToIpv4(~mask >>> 0)}`,
      `Broadcast   ${intToIpv4(bc)}`,
      `First host  ${intToIpv4(bits >= 31 ? net : net + 1)}`,
      `Last host   ${intToIpv4(bits >= 31 ? bc : bc - 1)}`,
      `Hosts       ${hosts}`,
      `Total       ${2 ** (32 - bits)}`,
    ].join("\n")
  },
})

tool({
  id: "net:inCidr",
  name: "IP in CIDR?",
  category: CAT,
  description: "Tests whether an IPv4 address falls inside a CIDR range. Outputs true or false.",
  keywords: ["contains", "subnet", "allow list", "firewall"],
  inputs: [{ id: "in", label: "IP" }],
  outputs: [{ id: "out", label: "Inside" }],
  params: [text("cidr", "CIDR", "10.0.0.0/8", { mono: true })],
  run: ({ inputs, params }) => {
    const [base, b] = str_(params, "cidr").split("/")
    const bits = Number(b ?? 32)
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
    return { out: ((ipv4ToInt(toText(inputs.in)) & mask) >>> 0) === ((ipv4ToInt(base) & mask) >>> 0) }
  },
})

simple({
  id: "net:ipv6",
  name: "IPv6 expand / compress",
  category: CAT,
  description: "Normalises an IPv6 address to its full or shortest form.",
  keywords: ["ip address", "colon", "shorten"],
  params: [select("mode", "Mode", ["Expand", "Compress"])],
  run: (s: string, p) => {
    let t = s.trim().toLowerCase().replace(/^\[|\]$/g, "")
    if (!/^[0-9a-f:.]+$/.test(t) || !t.includes(":")) throw new Error("Not an IPv6 address")
    const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(t)
    if (v4) {
      const n = ipv4ToInt(v4[1])
      t = t.replace(v4[1], `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`)
    }
    let groups: string[]
    if (t.includes("::")) {
      const [l, r] = t.split("::")
      const L = l ? l.split(":") : []
      const R = r ? r.split(":") : []
      groups = [...L, ...new Array(8 - L.length - R.length).fill("0"), ...R]
    } else groups = t.split(":")
    if (groups.length !== 8) throw new Error("Wrong number of groups")
    const full = groups.map((g) => g.padStart(4, "0"))
    if (p.mode === "Expand") return full.join(":")
    const short = groups.map((g) => g.replace(/^0+(?=.)/, ""))
    let best = [-1, 0]
    for (let i = 0; i < 8; ) {
      if (short[i] !== "0") { i++; continue }
      let j = i
      while (j < 8 && short[j] === "0") j++
      if (j - i > best[1]) best = [i, j - i]
      i = j
    }
    if (best[1] < 2) return short.join(":")
    return short.slice(0, best[0]).join(":") + "::" + short.slice(best[0] + best[1]).join(":")
  },
})

simple({
  id: "net:mac",
  name: "MAC address format",
  category: CAT,
  description: "Rewrites a MAC address with the separator and case you want.",
  keywords: ["hardware address", "ethernet", "oui"],
  params: [select("sep", "Separator", [[":", "Colon"], ["-", "Dash"], [".", "Cisco dots"], ["", "None"]]), toggle("upper", "Uppercase", false)],
  run: (s: string, p) => {
    const h = s.replace(/[^0-9a-f]/gi, "").toLowerCase()
    if (h.length !== 12) throw new Error("A MAC address has 12 hex digits")
    const sep = str_(p, "sep")
    const parts = sep === "." ? h.match(/.{4}/g)! : h.match(/.{2}/g)!
    const out = parts.join(sep)
    return bool_(p, "upper") ? out.toUpperCase() : out
  },
})

simple({
  id: "net:userAgent",
  name: "Parse User-Agent",
  category: CAT,
  description: "Rough browser, engine and OS detection from a User-Agent string.",
  keywords: ["browser", "ua", "http header", "device"],
  run: (s: string) => {
    const pick = (list: [RegExp, string][]) => list.map(([re, n]) => { const m = re.exec(s); return m ? `${n}${m[1] ? " " + m[1] : ""}` : null }).find(Boolean) ?? "unknown"
    const browser = pick([[/Edg\/([\d.]+)/, "Edge"], [/OPR\/([\d.]+)/, "Opera"], [/Firefox\/([\d.]+)/, "Firefox"], [/Chrome\/([\d.]+)/, "Chrome"], [/Version\/([\d.]+).*Safari/, "Safari"], [/curl\/([\d.]+)/, "curl"]])
    const engine = pick([[/AppleWebKit\/([\d.]+)/, "WebKit"], [/Gecko\/(\d+)/, "Gecko"], [/Trident\/([\d.]+)/, "Trident"]])
    const os = pick([[/Windows NT ([\d.]+)/, "Windows NT"], [/Android ([\d.]+)/, "Android"], [/iPhone OS ([\d_]+)/, "iOS"], [/Mac OS X ([\d_.]+)/, "macOS"], [/Linux/, "Linux"], [/CrOS/, "ChromeOS"]])
    const device = /Mobile|Android|iPhone/.test(s) ? "mobile" : /iPad|Tablet/.test(s) ? "tablet" : "desktop"
    return `Browser  ${browser}\nEngine   ${engine}\nOS       ${os.replace(/_/g, ".")}\nDevice   ${device}`
  },
})

const STATUS: Record<number, string> = {
  100: "Continue", 101: "Switching Protocols", 200: "OK", 201: "Created", 202: "Accepted", 204: "No Content", 206: "Partial Content",
  301: "Moved Permanently", 302: "Found", 303: "See Other", 304: "Not Modified", 307: "Temporary Redirect", 308: "Permanent Redirect",
  400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 405: "Method Not Allowed", 406: "Not Acceptable",
  408: "Request Timeout", 409: "Conflict", 410: "Gone", 411: "Length Required", 413: "Payload Too Large", 414: "URI Too Long",
  415: "Unsupported Media Type", 418: "I'm a teapot", 422: "Unprocessable Content", 425: "Too Early", 429: "Too Many Requests",
  431: "Request Header Fields Too Large", 451: "Unavailable For Legal Reasons", 500: "Internal Server Error", 501: "Not Implemented",
  502: "Bad Gateway", 503: "Service Unavailable", 504: "Gateway Timeout", 505: "HTTP Version Not Supported",
}
simple({
  id: "net:httpStatus",
  name: "HTTP status lookup",
  category: CAT,
  description: "Name and class of an HTTP status code. Leave empty to list the common ones.",
  keywords: ["response", "code", "404", "200", "reason phrase"],
  run: (s: string) => {
    const n = Number(s.trim())
    if (!s.trim()) return Object.entries(STATUS).map(([k, v]) => `${k} ${v}`).join("\n")
    const cls = ["", "Informational", "Success", "Redirection", "Client error", "Server error"][Math.floor(n / 100)] ?? "Unknown"
    return `${n} ${STATUS[n] ?? "(unassigned or uncommon)"}\n${cls}`
  },
})

const PORTS: Record<number, string> = {
  20: "FTP data", 21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS", 67: "DHCP server", 68: "DHCP client", 69: "TFTP", 80: "HTTP", 110: "POP3",
  123: "NTP", 143: "IMAP", 161: "SNMP", 389: "LDAP", 443: "HTTPS", 445: "SMB", 465: "SMTPS", 587: "SMTP submission", 636: "LDAPS", 993: "IMAPS",
  995: "POP3S", 1433: "MS SQL", 1521: "Oracle", 2049: "NFS", 3000: "dev server", 3306: "MySQL", 3389: "RDP", 5432: "PostgreSQL", 5672: "AMQP",
  5900: "VNC", 6379: "Redis", 8080: "HTTP alt", 8443: "HTTPS alt", 9200: "Elasticsearch", 11211: "Memcached", 27017: "MongoDB",
}
simple({
  id: "net:port",
  name: "Port lookup",
  category: CAT,
  description: "Which well-known service uses a port. Leave empty to list them.",
  keywords: ["tcp", "udp", "service", "iana"],
  run: (s: string) => {
    if (!s.trim()) return Object.entries(PORTS).map(([k, v]) => `${k.padEnd(6)} ${v}`).join("\n")
    const n = Number(s.trim())
    return `${n}: ${PORTS[n] ?? "no well-known service"}`
  },
})

simple({
  id: "net:basicAuth",
  name: "Basic auth header",
  category: CAT,
  description: "Builds an HTTP Authorization header from 'user:password'.",
  keywords: ["http", "credentials", "authorization"],
  run: (s: string) => `Authorization: Basic ${btoa(unescape(encodeURIComponent(s)))}`,
})

simple({
  id: "net:dataUri",
  name: "Parse data URI",
  category: CAT,
  description: "Extracts the media type and decoded payload of a data: URI.",
  keywords: ["base64", "inline", "mime"],
  output: "bytes",
  input: "text",
  run: (s: string) => {
    const m = /^data:([^,;]*)((?:;[^,]*)*),([\s\S]*)$/.exec(s.trim())
    if (!m) throw new Error("Not a data: URI")
    if (/;base64/i.test(m[2])) return Uint8Array.from(atob(m[3].replace(/\s/g, "")), (c) => c.charCodeAt(0))
    return new TextEncoder().encode(decodeURIComponent(m[3]))
  },
})

void num
