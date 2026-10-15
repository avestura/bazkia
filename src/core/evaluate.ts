import { getTool } from "./registry"
import { IN, OUT, PARAM } from "./types"
import type { NodeResult, Outputs, Params, ToolDef, Value } from "./types"
import { toBool, toNumber, toText } from "./values"

export interface GraphNode {
  id: string
  tool: string
  params: Params
}

export interface GraphEdge {
  id: string
  source: string
  sourceHandle?: string | null
  target: string
  targetHandle?: string | null
}

export interface CacheEntry {
  key: unknown[]
  result: NodeResult
}

export type EvalCache = Map<string, CacheEntry>

export interface EvalOptions {
  ticks?: Record<string, number>
  cache?: EvalCache
  signal?: AbortSignal
}

const sameKey = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((v, i) => v === b[i])

function coerceParam(def: ToolDef["params"][number], v: Value, fallback: Params[string]): Params[string] {
  if (v === undefined) return fallback
  switch (def.type) {
    case "number": return toNumber(v, Number(fallback))
    case "toggle": return toBool(v)
    default: return toText(v)
  }
}

/**
 * Runs every node in dependency order. Pure apart from the optional cache, which lets
 * unchanged nodes keep their previous result.
 */
export async function evaluate(
  nodes: GraphNode[],
  edges: GraphEdge[],
  opts: EvalOptions = {},
): Promise<Record<string, NodeResult>> {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const incoming = new Map<string, GraphEdge[]>()
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue
    if (!incoming.has(e.target)) incoming.set(e.target, [])
    incoming.get(e.target)!.push(e)
  }

  const results: Record<string, NodeResult> = {}
  const state = new Map<string, "visiting" | "done">()
  const signal = opts.signal ?? new AbortController().signal

  async function visit(id: string): Promise<NodeResult> {
    if (state.get(id) === "done") return results[id]
    if (state.get(id) === "visiting") return { outputs: {}, error: "Cycle in graph", ms: 0 }
    state.set(id, "visiting")
    const node = byId.get(id)!
    const def = getTool(node.tool)
    let result: NodeResult
    if (!def) {
      result = { outputs: {}, error: `Unknown tool "${node.tool}"`, ms: 0 }
    } else if (def.annotation) {
      result = { outputs: {}, ms: 0 }
    } else {
      const inputs: Record<string, Value> = {}
      const params: Params = { ...node.params }
      let upstreamFailed = false
      let cycle = false
      for (const e of incoming.get(id) ?? []) {
        const up = await visit(e.source)
        if (up.error === "Cycle in graph") cycle = true
        else if (up.error) upstreamFailed = true
        const from = (e.sourceHandle ?? "").startsWith(OUT) ? e.sourceHandle!.slice(OUT.length) : (e.sourceHandle ?? "")
        const val = up.outputs[from]
        const th = e.targetHandle ?? ""
        if (th.startsWith(PARAM)) {
          const pid = th.slice(PARAM.length)
          const pdef = def.params.find((p) => p.id === pid)
          if (pdef) params[pid] = coerceParam(pdef, val, params[pid])
        } else {
          inputs[th.startsWith(IN) ? th.slice(IN.length) : th] = val
        }
      }
      if (cycle) {
        result = { outputs: {}, error: "Cycle in graph", ms: 0 }
      } else if (upstreamFailed) {
        result = { outputs: {}, error: "An upstream node failed", ms: 0 }
      } else {
        const tick = opts.ticks?.[id] ?? 0
        const key: unknown[] = [def, JSON.stringify(params), tick, ...def.inputs.map((p) => inputs[p.id])]
        const hit = opts.cache?.get(id)
        if (hit && sameKey(hit.key, key)) {
          result = hit.result
        } else {
          const t0 = performance.now()
          try {
            const outputs: Outputs = await def.run({ inputs, params, tick, signal })
            result = { outputs, ms: performance.now() - t0 }
          } catch (err) {
            if (signal.aborted) throw err
            result = { outputs: {}, error: err instanceof Error ? err.message : String(err), ms: performance.now() - t0 }
          }
          opts.cache?.set(id, { key, result })
        }
      }
    }
    results[id] = result
    state.set(id, "done")
    return result
  }

  // Independent branches run concurrently; shared upstream nodes are memoised by `state`.
  for (const n of nodes) {
    if (signal.aborted) throw new DOMException("aborted", "AbortError")
    await visit(n.id)
  }
  return results
}

export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("aborted", "AbortError"))
    const t = setTimeout(resolve, ms)
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(t)
        reject(new DOMException("aborted", "AbortError"))
      },
      { once: true },
    )
  })
}
