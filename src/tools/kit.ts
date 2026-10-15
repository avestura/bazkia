import { registerTool } from "../core/registry"
import type { Outputs, ParamDef, Params, PortDef, ToolDef, Value } from "../core/types"
import { toBytes, toText } from "../core/values"

export type { ParamDef, Params, Value }

export const text = (id: string, label: string, def = "", extra: Partial<ParamDef> = {}): ParamDef => ({
  id,
  label,
  type: "text",
  default: def,
  ...extra,
})
export const area = (id: string, label: string, def = "", extra: Partial<ParamDef> = {}): ParamDef => ({
  id,
  label,
  type: "textarea",
  default: def,
  rows: 4,
  mono: true,
  ...extra,
})
export const num = (id: string, label: string, def = 0, extra: Partial<ParamDef> = {}): ParamDef => ({
  id,
  label,
  type: "number",
  default: def,
  ...extra,
})
export const toggle = (id: string, label: string, def = false, extra: Partial<ParamDef> = {}): ParamDef => ({
  id,
  label,
  type: "toggle",
  default: def,
  ...extra,
})
export const select = (
  id: string,
  label: string,
  options: (string | [string, string])[],
  def?: string,
  extra: Partial<ParamDef> = {},
): ParamDef => {
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : { value: o[0], label: o[1] }))
  return { id, label, type: "select", default: def ?? opts[0].value, options: opts, ...extra }
}

export const IN_PORT: PortDef = { id: "in", label: "Input" }
export const OUT_PORT: PortDef = { id: "out", label: "Output" }

export function defaultParams(params: ParamDef[]): Params {
  return Object.fromEntries(params.map((p) => [p.id, p.default]))
}

export function tool(def: Omit<ToolDef, "inputs" | "outputs" | "params" | "run"> & Partial<ToolDef> & Pick<ToolDef, "run">) {
  const full: ToolDef = { inputs: [], outputs: [], params: [], ...def }
  registerTool(full)
  return full
}

export interface SimpleOpts {
  id: string
  name: string
  category: string
  description: string
  keywords?: string[]
  params?: ParamDef[]
  /** how the input is handed to `run` */
  input?: "text" | "bytes"
  /** how the output is declared on the port (affects previews only) */
  output?: "text" | "bytes"
  run: (input: any, p: Params) => Value | Promise<Value>
}

/** One input, one output. Covers most operations. */
export function simple(o: SimpleOpts) {
  const inKind = o.input ?? "text"
  return tool({
    id: o.id,
    name: o.name,
    category: o.category,
    description: o.description,
    keywords: o.keywords,
    params: o.params ?? [],
    inputs: [{ id: "in", label: "Input", kind: inKind }],
    outputs: [{ id: "out", label: "Output", kind: o.output ?? "text" }],
    run: async ({ inputs, params }) => {
      const raw = inputs.in
      const input = inKind === "bytes" ? toBytes(raw) : toText(raw)
      return { out: await o.run(input, params) }
    },
  })
}

/** Two inputs (A and B), one output. */
export function binary(o: Omit<SimpleOpts, "run" | "input"> & { run: (a: string, b: string, p: Params) => Value | Promise<Value>; labels?: [string, string] }) {
  const [la, lb] = o.labels ?? ["A", "B"]
  return tool({
    id: o.id,
    name: o.name,
    category: o.category,
    description: o.description,
    keywords: o.keywords,
    params: o.params ?? [],
    inputs: [
      { id: "a", label: la },
      { id: "b", label: lb },
    ],
    outputs: [{ id: "out", label: "Output" }],
    run: async ({ inputs, params }) => ({ out: await o.run(toText(inputs.a), toText(inputs.b), params) }) as Outputs,
  })
}

/** Generates a family of near-identical tools from a table. */
export function family<T>(rows: T[], make: (row: T) => void) {
  rows.forEach(make)
}

export const num_ = (p: Params, id: string): number => Number(p[id])
export const str_ = (p: Params, id: string): string => String(p[id] ?? "")
export const bool_ = (p: Params, id: string): boolean => p[id] === true || p[id] === "true"

/** Parses an escape-friendly delimiter name or literal. */
export function delimiter(name: string, custom = ""): string {
  switch (name) {
    case "Space": return " "
    case "Comma": return ","
    case "Semi-colon": return ";"
    case "Colon": return ":"
    case "Tab": return "\t"
    case "Line feed": return "\n"
    case "CRLF": return "\r\n"
    case "None": return ""
    case "Custom": return custom.replace(/\n/g, "\n").replace(/\t/g, "\t").replace(/\r/g, "\r")
    default: return name
  }
}

export const DELIMS = ["Space", "Comma", "Semi-colon", "Colon", "Tab", "Line feed", "CRLF", "None"]
