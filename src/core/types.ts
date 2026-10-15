/** A value travelling along a link. Text and bytes are interchangeable via coercion. */
export type Value = string | number | boolean | Uint8Array | null | undefined | object

export type ParamType = "text" | "textarea" | "number" | "toggle" | "select"

export interface ParamOption {
  value: string
  label: string
}

export interface ParamDef {
  id: string
  label: string
  type: ParamType
  default: string | number | boolean
  options?: ParamOption[]
  min?: number
  max?: number
  step?: number
  placeholder?: string
  help?: string
  /** monospace text field */
  mono?: boolean
  rows?: number
}

export type PortKind = "text" | "bytes" | "number" | "any"

export interface PortDef {
  id: string
  label: string
  kind?: PortKind
}

export type Params = Record<string, string | number | boolean>

export interface RunContext {
  inputs: Record<string, Value>
  params: Params
  /** increments each time a live node (counter, clock) fires */
  tick: number
  signal: AbortSignal
}

export type Outputs = Record<string, Value>

export interface ToolDef {
  id: string
  name: string
  category: string
  description: string
  keywords?: string[]
  inputs: PortDef[]
  outputs: PortDef[]
  params: ParamDef[]
  /** set for tools that re-run on a timer, in milliseconds */
  live?: (params: Params) => number
  /** shows a re-roll button that re-runs the node (random generators) */
  reroll?: boolean
  /** display-only tools render the incoming value inside the node */
  display?: boolean
  /** free-form annotation tools: no ports, no evaluation */
  annotation?: boolean
  run: (ctx: RunContext) => Outputs | Promise<Outputs>
}

export interface NodeData extends Record<string, unknown> {
  tool: string
  params: Params
  label?: string
}

export interface NodeResult {
  outputs: Outputs
  error?: string
  ms: number
}

/** On-disk project format. */
export interface ProjectFile {
  format: "bazkia"
  version: 1
  name: string
  nodes: { id: string; tool: string; x: number; y: number; params: Params; label?: string }[]
  edges: { id: string; source: string; sourceHandle: string; target: string; targetHandle: string }[]
}

export const IN = "in:"
export const OUT = "out:"
export const PARAM = "param:"
