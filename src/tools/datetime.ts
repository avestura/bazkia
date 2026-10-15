import { bool_, num, select, simple, str_, text, tool, toggle, IN_PORT } from "./kit"
import { toText } from "../core/values"

const CAT = "Date & time"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

/** Reads wall-clock fields of an instant in a given IANA zone (or "UTC" / "local"). */
export function zoned(d: Date, tz: string) {
  const zone = tz === "local" ? undefined : tz
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short", timeZoneName: "longOffset",
  }).formatToParts(d)
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
  const off = g("timeZoneName").replace("GMT", "") || "+00:00"
  return {
    Y: Number(g("year")), M: Number(g("month")), D: Number(g("day")),
    h: Number(g("hour")) % 24, m: Number(g("minute")), s: Number(g("second")),
    ms: d.getUTCMilliseconds(), offset: off === "" ? "+00:00" : off,
    dow: DAYS.findIndex((n) => n.startsWith(g("weekday"))),
  }
}

export function formatDate(d: Date, pattern: string, tz = "UTC"): string {
  const z = zoned(d, tz)
  const p2 = (n: number) => String(n).padStart(2, "0")
  const h12 = z.h % 12 || 12
  const map: Record<string, string> = {
    YYYY: String(z.Y), YY: String(z.Y).slice(-2), MMMM: MONTHS[z.M - 1], MMM: MONTHS[z.M - 1].slice(0, 3), MM: p2(z.M), M: String(z.M),
    DD: p2(z.D), D: String(z.D), dddd: DAYS[z.dow], ddd: DAYS[z.dow].slice(0, 3),
    HH: p2(z.h), H: String(z.h), hh: p2(h12), h: String(h12), mm: p2(z.m), ss: p2(z.s), SSS: String(z.ms).padStart(3, "0"),
    A: z.h < 12 ? "AM" : "PM", a: z.h < 12 ? "am" : "pm", Z: z.offset, X: String(Math.floor(d.getTime() / 1000)),
  }
  return pattern.replace(/\[([^\]]*)\]|YYYY|YY|MMMM|MMM|MM|M|DD|D|dddd|ddd|HH|H|hh|h|mm|ss|SSS|A|a|Z|X/g, (m, lit) => lit ?? map[m] ?? m)
}

export function parseDate(s: string): Date {
  const t = s.trim()
  if (!t) throw new Error("Empty input")
  if (/^-?\d+(\.\d+)?$/.test(t)) {
    const n = Number(t)
    // seconds, milliseconds, microseconds or nanoseconds, by magnitude
    const abs = Math.abs(n)
    return new Date(abs < 1e11 ? n * 1000 : abs < 1e14 ? n : abs < 1e17 ? n / 1000 : n / 1e6)
  }
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) throw new Error(`Could not parse "${t}" as a date`)
  return d
}

const TZ = ["UTC", "local", "America/New_York", "America/Los_Angeles", "America/Sao_Paulo", "Europe/London", "Europe/Berlin", "Europe/Moscow", "Asia/Tehran", "Asia/Dubai", "Asia/Kolkata", "Asia/Shanghai", "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland"]

simple({
  id: "time:parse",
  name: "Parse date / timestamp",
  category: CAT,
  description: "Reads ISO dates, RFC 2822 dates or Unix timestamps (seconds, ms, µs or ns detected by size) and prints them several ways.",
  keywords: ["unix", "epoch", "iso", "convert", "timestamp", "datetime"],
  params: [select("tz", "Show in zone", TZ)],
  run: (s: string, p) => {
    const d = parseDate(s)
    const tz = str_(p, "tz")
    return [
      `ISO 8601    ${d.toISOString()}`,
      `Local fmt   ${formatDate(d, "dddd, D MMMM YYYY HH:mm:ss Z", tz)}`,
      `Unix (s)    ${Math.floor(d.getTime() / 1000)}`,
      `Unix (ms)   ${d.getTime()}`,
      `RFC 2822    ${d.toUTCString()}`,
      `Relative    ${relative(d)}`,
    ].join("\n")
  },
})

function relative(d: Date) {
  const diff = (d.getTime() - Date.now()) / 1000
  const abs = Math.abs(diff)
  const units: [number, string][] = [[31536000, "year"], [2592000, "month"], [86400, "day"], [3600, "hour"], [60, "minute"], [1, "second"]]
  for (const [sec, name] of units) if (abs >= sec) {
    const n = Math.floor(abs / sec)
    return diff < 0 ? `${n} ${name}${n > 1 ? "s" : ""} ago` : `in ${n} ${name}${n > 1 ? "s" : ""}`
  }
  return "now"
}

simple({
  id: "time:toUnix",
  name: "Date to Unix",
  category: CAT,
  description: "Converts a date string to a Unix timestamp.",
  keywords: ["epoch", "timestamp", "seconds", "milliseconds"],
  params: [select("unit", "Unit", [["s", "Seconds"], ["ms", "Milliseconds"]])],
  run: (s: string, p) => String(p.unit === "ms" ? parseDate(s).getTime() : Math.floor(parseDate(s).getTime() / 1000)),
})

simple({
  id: "time:fromUnix",
  name: "Unix to date",
  category: CAT,
  description: "Converts a Unix timestamp to a formatted date.",
  keywords: ["epoch", "timestamp", "iso", "format"],
  params: [text("pattern", "Format", "YYYY-MM-DD HH:mm:ss", { mono: true, help: "YYYY MM DD HH mm ss SSS ddd MMM A Z, [literal]" }), select("tz", "Zone", TZ), select("unit", "Input unit", [["auto", "Auto"], ["s", "Seconds"], ["ms", "Milliseconds"]])],
  run: (s: string, p) => {
    const n = Number(s.trim())
    if (Number.isNaN(n)) throw new Error("Not a number")
    const d = p.unit === "s" ? new Date(n * 1000) : p.unit === "ms" ? new Date(n) : parseDate(s)
    return formatDate(d, str_(p, "pattern"), str_(p, "tz"))
  },
})

simple({
  id: "time:format",
  name: "Format date",
  category: CAT,
  description: "Reformats any parseable date with a pattern, in any time zone.",
  keywords: ["strftime", "pattern", "timezone", "convert"],
  params: [text("pattern", "Format", "YYYY-MM-DD[T]HH:mm:ssZ", { mono: true, help: "YYYY MM DD HH mm ss SSS ddd MMM A Z, [literal]" }), select("tz", "Zone", TZ)],
  run: (s: string, p) => formatDate(parseDate(s), str_(p, "pattern"), str_(p, "tz")),
})

simple({
  id: "time:add",
  name: "Add / subtract time",
  category: CAT,
  description: "Moves a date forward or backward by an amount. Output is ISO 8601 in UTC.",
  keywords: ["offset", "shift", "plus", "minus", "duration"],
  params: [num("amount", "Amount", 1), select("unit", "Unit", ["seconds", "minutes", "hours", "days", "weeks", "months", "years"], "days")],
  run: (s: string, p) => {
    const d = parseDate(s)
    const n = Number(p.amount)
    switch (p.unit) {
      case "seconds": d.setTime(d.getTime() + n * 1000); break
      case "minutes": d.setTime(d.getTime() + n * 60000); break
      case "hours": d.setTime(d.getTime() + n * 3600000); break
      case "days": d.setUTCDate(d.getUTCDate() + n); break
      case "weeks": d.setUTCDate(d.getUTCDate() + n * 7); break
      case "months": d.setUTCMonth(d.getUTCMonth() + n); break
      default: d.setUTCFullYear(d.getUTCFullYear() + n)
    }
    return d.toISOString()
  },
})

tool({
  id: "time:diff",
  name: "Time between",
  category: CAT,
  description: "How long from A to B, as a duration and in single units.",
  keywords: ["difference", "duration", "elapsed", "interval"],
  inputs: [{ id: "a", label: "From" }, { id: "b", label: "To" }],
  outputs: [{ id: "out", label: "Duration" }, { id: "seconds", label: "Seconds", kind: "number" }],
  run: ({ inputs }) => {
    const ms = parseDate(toText(inputs.b)).getTime() - parseDate(toText(inputs.a)).getTime()
    return { out: humanDuration(ms / 1000), seconds: ms / 1000 }
  },
})

export function humanDuration(totalSeconds: number): string {
  const neg = totalSeconds < 0
  let s = Math.round(Math.abs(totalSeconds))
  const parts: string[] = []
  for (const [n, u] of [[86400, "d"], [3600, "h"], [60, "m"], [1, "s"]] as const) {
    const q = Math.floor(s / n)
    if (q) parts.push(`${q}${u}`)
    s -= q * n
  }
  return (neg ? "-" : "") + (parts.join(" ") || "0s")
}

simple({
  id: "time:humanDuration",
  name: "Seconds to duration",
  category: CAT,
  description: "Turns 93784 into 1d 2h 3m 4s.",
  keywords: ["humanize", "elapsed", "format"],
  run: (s: string) => humanDuration(Number(s.trim())),
})

simple({
  id: "time:filetime",
  name: "Windows FILETIME",
  category: CAT,
  description: "Converts between Windows FILETIME (100 ns ticks since 1601) and Unix time.",
  keywords: ["ntfs", "windows", "ticks", "active directory"],
  params: [select("dir", "Direction", [["from", "FILETIME to date"], ["to", "Date to FILETIME"]])],
  run: (s: string, p) => {
    const EPOCH = 116444736000000000n
    if (p.dir === "to") return String(BigInt(parseDate(s).getTime()) * 10000n + EPOCH)
    return new Date(Number((BigInt(s.trim()) - EPOCH) / 10000n)).toISOString()
  },
})

simple({
  id: "time:dayOfYear",
  name: "Day of week / week number",
  category: CAT,
  description: "Weekday, day of year and ISO week number of a date.",
  keywords: ["calendar", "iso week", "weekday"],
  run: (s: string) => {
    const d = parseDate(s)
    const start = Date.UTC(d.getUTCFullYear(), 0, 0)
    const doy = Math.floor((d.getTime() - start) / 86400000)
    const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    const dn = t.getUTCDay() || 7
    t.setUTCDate(t.getUTCDate() + 4 - dn)
    const week = Math.ceil(((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7)
    return `${DAYS[d.getUTCDay()]}\nDay of year ${doy}\nISO week ${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`
  },
})

simple({
  id: "time:cron",
  name: "Cron next runs",
  category: CAT,
  description: "Lists upcoming UTC fire times for a 5-field cron expression (minute hour day month weekday; supports * , - /).",
  keywords: ["schedule", "crontab", "job", "next"],
  params: [num("count", "How many", 5, { min: 1, max: 30 })],
  run: (s: string, p) => {
    const f = s.trim().split(/\s+/)
    if (f.length !== 5) throw new Error("Expected 5 fields: minute hour day month weekday")
    const ranges: [number, number][] = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 6]]
    const sets = f.map((field, i) => {
      const [lo, hi] = ranges[i]
      const set = new Set<number>()
      for (const part of field.split(",")) {
        const [rng, stepS] = part.split("/")
        const step = stepS ? Number(stepS) : 1
        let a = lo
        let b = hi
        if (rng !== "*") {
          const [x, y] = rng.split("-")
          a = Number(x)
          b = y !== undefined ? Number(y) : stepS ? hi : a
        }
        if ([a, b, step].some(Number.isNaN) || step < 1) throw new Error(`Bad field: ${field}`)
        for (let v = a; v <= b; v += step) set.add(i === 4 && v === 7 ? 0 : v)
      }
      return set
    })
    const out: string[] = []
    const d = new Date(Math.floor(Date.now() / 60000) * 60000 + 60000)
    for (let i = 0; i < 600000 && out.length < Number(p.count); i++, d.setTime(d.getTime() + 60000)) {
      const domOk = sets[2].has(d.getUTCDate())
      const dowOk = sets[4].has(d.getUTCDay())
      const dayOk = f[2] !== "*" && f[4] !== "*" ? domOk || dowOk : domOk && dowOk
      if (sets[0].has(d.getUTCMinutes()) && sets[1].has(d.getUTCHours()) && sets[3].has(d.getUTCMonth() + 1) && dayOk) out.push(d.toISOString())
    }
    return out.join("\n") || "No run in the next ~1 year"
  },
})

void bool_
void toggle
void IN_PORT
