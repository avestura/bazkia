import { sleep } from "../core/evaluate"
import { tool, text, area, num, select, toggle, IN_PORT, OUT_PORT } from "./kit"
import { toBytes, toText } from "../core/values"

tool({
  id: "input:text",
  name: "Text",
  category: "Input",
  description: "A block of text you type in. Wire it into anything.",
  keywords: ["string", "source", "plain"],
  params: [area("text", "Text", "Hello, Bazkia!", { rows: 3 })],
  outputs: [{ id: "out", label: "Text", kind: "text" }],
  run: ({ params }) => ({ out: String(params.text) }),
})

tool({
  id: "input:number",
  name: "Number",
  category: "Input",
  description: "A single number.",
  keywords: ["integer", "float", "constant"],
  params: [num("value", "Value", 42)],
  outputs: [{ id: "out", label: "Number", kind: "number" }],
  run: ({ params }) => ({ out: Number(params.value) }),
})

tool({
  id: "input:hex",
  name: "Hex bytes",
  category: "Input",
  description: "Type hex digits, get raw bytes. Spaces, 0x prefixes and newlines are ignored.",
  keywords: ["binary", "bytes", "source"],
  params: [area("hex", "Hex", "de ad be ef", { rows: 2 })],
  outputs: [{ id: "out", label: "Bytes", kind: "bytes" }],
  run: ({ params }) => {
    const clean = String(params.hex).replace(/0x/gi, "").replace(/[^0-9a-f]/gi, "")
    if (clean.length % 2) throw new Error("Odd number of hex digits")
    const out = new Uint8Array(clean.length / 2)
    for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16)
    return { out }
  },
})

tool({
  id: "input:counter",
  name: "Counter",
  category: "Input",
  description: "Counts up on a timer. Use it to drive a graph and watch it recompute.",
  keywords: ["timer", "interval", "live", "tick"],
  params: [num("interval", "Interval (ms)", 1000, { min: 100, step: 100 }), num("start", "Start at", 0)],
  outputs: [{ id: "out", label: "Count", kind: "number" }],
  live: (p) => Math.max(100, Number(p.interval)),
  run: ({ params, tick }) => ({ out: Number(params.start) + tick }),
})

tool({
  id: "input:clock",
  name: "Clock",
  category: "Input",
  description: "The current time, refreshed on a timer.",
  keywords: ["now", "time", "date", "timestamp", "live"],
  params: [num("interval", "Interval (ms)", 1000, { min: 100, step: 100 })],
  outputs: [
    { id: "iso", label: "ISO 8601" },
    { id: "unix", label: "Unix (s)", kind: "number" },
    { id: "ms", label: "Unix (ms)", kind: "number" },
  ],
  live: (p) => Math.max(100, Number(p.interval)),
  run: () => {
    const d = new Date()
    return { iso: d.toISOString(), unix: Math.floor(d.getTime() / 1000), ms: d.getTime() }
  },
})

tool({
  id: "input:random",
  name: "Random bytes",
  category: "Input",
  description: "Cryptographically secure random bytes from the system. Press re-roll for new ones.",
  keywords: ["rng", "entropy", "nonce", "iv", "key", "salt"],
  params: [num("length", "Length (bytes)", 16, { min: 0, max: 65536 })],
  outputs: [{ id: "out", label: "Bytes", kind: "bytes" }],
  reroll: true,
  run: ({ params }) => {
    const out = new Uint8Array(Math.max(0, Math.min(65536, Number(params.length))))
    for (let i = 0; i < out.length; i += 65536) crypto.getRandomValues(out.subarray(i, i + 65536))
    return { out }
  },
})

tool({
  id: "flow:debounce",
  name: "Debounce",
  category: "Input",
  description: "Passes a value on only after it has stopped changing for a while. Handy for heavy tools downstream.",
  keywords: ["delay", "wait", "throttle", "flow"],
  params: [num("delay", "Quiet period (ms)", 400, { min: 0, max: 10000, step: 50 })],
  inputs: [IN_PORT],
  outputs: [OUT_PORT],
  run: async ({ inputs, params, signal }) => {
    await sleep(Number(params.delay), signal)
    return { out: inputs.in }
  },
})

tool({
  id: "flow:switch",
  name: "Switch",
  category: "Input",
  description: "Picks input A or B depending on a toggle. Wire a Number or Text into the toggle to drive it.",
  keywords: ["if", "choose", "select", "conditional", "flow"],
  params: [toggle("useB", "Use B", false)],
  inputs: [
    { id: "a", label: "A" },
    { id: "b", label: "B" },
  ],
  outputs: [OUT_PORT],
  run: ({ inputs, params }) => ({ out: params.useB ? inputs.b : inputs.a }),
})

tool({
  id: "output:display",
  name: "Display",
  category: "Output",
  description: "Shows whatever arrives, as text, hex or a hex dump. Passes the value through.",
  keywords: ["view", "show", "result", "inspect", "print", "sink"],
  params: [select("view", "View", [["auto", "Auto"], ["text", "Text"], ["hex", "Hex"], ["dump", "Hex dump"]], "auto")],
  inputs: [IN_PORT],
  outputs: [OUT_PORT],
  display: true,
  run: ({ inputs }) => ({ out: inputs.in }),
})

tool({
  id: "output:note",
  name: "Note",
  category: "Output",
  description: "A free-form label for documenting a graph. Takes no part in evaluation.",
  keywords: ["comment", "annotation", "label", "sticky"],
  params: [area("text", "Note", "Describe this part of the graph.", { rows: 3, mono: false })],
  annotation: true,
  run: () => ({}),
})

tool({
  id: "output:length",
  name: "Length",
  category: "Output",
  description: "Number of characters, bytes and lines in the input.",
  keywords: ["size", "count", "chars", "bytes", "lines"],
  inputs: [IN_PORT],
  outputs: [
    { id: "chars", label: "Chars", kind: "number" },
    { id: "bytes", label: "Bytes", kind: "number" },
    { id: "lines", label: "Lines", kind: "number" },
  ],
  run: ({ inputs }) => {
    const t = toText(inputs.in)
    return { chars: [...t].length, bytes: toBytes(inputs.in).length, lines: t === "" ? 0 : t.split(/\r\n|\r|\n/).length }
  },
})

void text
