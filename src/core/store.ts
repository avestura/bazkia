import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react"
import { create } from "zustand"
import { evaluate, type EvalCache } from "./evaluate"
import { getTool } from "./registry"
import { IN, OUT, PARAM } from "./types"
import type { NodeData, NodeResult, Params, ProjectFile } from "./types"
import { defaultParams } from "../tools/kit"

export type BzNode = Node<NodeData, "tool">
export type BzEdge = Edge

export type ThemePref = "system" | "light" | "dark"

interface Snapshot {
  nodes: BzNode[]
  edges: BzEdge[]
}

interface State {
  name: string
  nodes: BzNode[]
  edges: BzEdge[]
  results: Record<string, NodeResult>
  evaluating: boolean
  evalMs: number
  past: Snapshot[]
  future: Snapshot[]
  dirty: boolean
  theme: ThemePref
  paletteOpen: boolean
  examplesOpen: boolean
  aboutOpen: boolean
  sidebarOpen: boolean
  inspectorOpen: boolean
  /** set when a link is dropped on empty canvas, to add + auto-connect a tool */
  pendingConnect: { nodeId: string; handleId: string; handleType: "source" | "target"; x: number; y: number } | null
  toast: { id: number; kind: "info" | "success" | "danger"; text: string } | null

  // graph
  addNode: (toolId: string, pos?: { x: number; y: number }, params?: Partial<Params>) => string | null
  setParam: (id: string, key: string, value: Params[string]) => void
  setLabel: (id: string, label: string) => void
  onNodesChange: (c: NodeChange<BzNode>[]) => void
  onEdgesChange: (c: EdgeChange<BzEdge>[]) => void
  onConnect: (c: Connection) => void
  isValidConnection: (c: Connection | BzEdge) => boolean
  removeSelected: () => void
  duplicateSelected: () => void
  selectAll: () => void
  bump: (id: string) => void
  commit: () => void
  undo: () => void
  redo: () => void
  autoLayout: (record?: boolean) => void
  // project
  newProject: () => void
  load: (p: ProjectFile) => void
  serialize: () => ProjectFile
  setName: (n: string) => void
  markSaved: () => void
  // ui
  set: (patch: Partial<State>) => void
  notify: (text: string, kind?: "info" | "success" | "danger") => void
}

let counter = 0
const newId = () => `n${Date.now().toString(36)}${(counter++).toString(36)}`
const snap = (v: number) => Math.round(v / 8) * 8
const MAX_HISTORY = 100

const ticks: Record<string, number> = {}
const cache: EvalCache = new Map()
let abort: AbortController | null = null
let timer: ReturnType<typeof setTimeout> | undefined
const intervals = new Map<string, { ms: number; handle: ReturnType<typeof setInterval> }>()

const THEME_KEY = "bazkia:theme"
const readTheme = (): ThemePref => {
  try {
    const v = localStorage.getItem(THEME_KEY)
    if (v === "light" || v === "dark" || v === "system") return v
  } catch { /* storage unavailable */ }
  return "system"
}

export const useStore = create<State>((set, get) => {
  const snapshot = (): Snapshot => ({
    nodes: get().nodes.map((n) => ({ ...n, selected: false, data: { ...n.data, params: { ...n.data.params } } })),
    edges: get().edges.map((e) => ({ ...e, selected: false })),
  })

  /** Record the *current* state as an undo point. Call before a mutation. */
  const pushHistory = () => {
    const past = [...get().past, snapshot()].slice(-MAX_HISTORY)
    set({ past, future: [], dirty: true })
  }

  return {
    name: "Untitled",
    nodes: [],
    edges: [],
    results: {},
    evaluating: false,
    evalMs: 0,
    past: [],
    future: [],
    dirty: false,
    theme: readTheme(),
    paletteOpen: false,
    examplesOpen: false,
    aboutOpen: false,
    sidebarOpen: true,
    inspectorOpen: true,
    pendingConnect: null,
    toast: null,

    addNode: (toolId, pos, params) => {
      const def = getTool(toolId)
      if (!def) return null
      pushHistory()
      const id = newId()
      const p = pos ?? { x: 96 + (get().nodes.length % 6) * 32, y: 96 + (get().nodes.length % 6) * 32 }
      const node: BzNode = {
        id,
        type: "tool",
        position: { x: snap(p.x), y: snap(p.y) },
        data: { tool: toolId, params: { ...defaultParams(def.params), ...params } as Params },
        selected: true,
      }
      set({ nodes: [...get().nodes.map((n) => ({ ...n, selected: false })), node] })
      scheduleEval()
      return id
    },

    setParam: (id, key, value) => {
      const cur = get().nodes.find((n) => n.id === id)
      if (!cur || cur.data.params[key] === value) return
      // Coalesce rapid typing into one undo step.
      const last = lastParamEdit
      const now = Date.now()
      if (!last || last.id !== id || last.key !== key || now - last.at > 800) pushHistory()
      lastParamEdit = { id, key, at: now }
      set({ nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, params: { ...n.data.params, [key]: value } } } : n)), dirty: true })
      scheduleEval()
    },

    setLabel: (id, label) => {
      pushHistory()
      set({ nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, label: label || undefined } } : n)) })
    },

    onNodesChange: (changes) => {
      const removing = changes.some((c) => c.type === "remove")
      const dragEnd = changes.some((c) => c.type === "position" && c.dragging === false)
      if (removing || dragEnd) pushHistoryBeforeChange(changes)
      set({ nodes: applyNodeChanges(changes, get().nodes) })
      if (removing) scheduleEval()
    },

    onEdgesChange: (changes) => {
      if (changes.some((c) => c.type === "remove")) {
        pushHistory()
        set({ edges: applyEdgeChanges(changes, get().edges) })
        scheduleEval()
      } else set({ edges: applyEdgeChanges(changes, get().edges) })
    },

    isValidConnection: (c) => {
      if (!c.source || !c.target || c.source === c.target) return false
      if (!c.sourceHandle?.startsWith(OUT)) return false
      if (!(c.targetHandle?.startsWith(IN) || c.targetHandle?.startsWith(PARAM))) return false
      // reject anything that would create a cycle
      const { edges } = get()
      const stack = [c.source]
      const seen = new Set<string>()
      while (stack.length) {
        const cur = stack.pop()!
        if (cur === c.target) return false
        if (seen.has(cur)) continue
        seen.add(cur)
        for (const e of edges) if (e.target === cur) stack.push(e.source)
      }
      return true
    },

    onConnect: (c) => {
      if (!get().isValidConnection(c)) return
      pushHistory()
      const edge: BzEdge = {
        id: `e${newId()}`,
        source: c.source!,
        sourceHandle: c.sourceHandle,
        target: c.target!,
        targetHandle: c.targetHandle,
        type: "step",
      }
      // one wire per input: replace what was there
      const rest = get().edges.filter((e) => !(e.target === edge.target && e.targetHandle === edge.targetHandle))
      set({ edges: [...rest, edge] })
      scheduleEval()
    },

    removeSelected: () => {
      const { nodes, edges } = get()
      const gone = new Set(nodes.filter((n) => n.selected).map((n) => n.id))
      const selEdges = new Set(edges.filter((e) => e.selected).map((e) => e.id))
      if (!gone.size && !selEdges.size) return
      pushHistory()
      set({
        nodes: nodes.filter((n) => !gone.has(n.id)),
        edges: edges.filter((e) => !selEdges.has(e.id) && !gone.has(e.source) && !gone.has(e.target)),
      })
      scheduleEval()
    },

    duplicateSelected: () => {
      const { nodes, edges } = get()
      const sel = nodes.filter((n) => n.selected)
      if (!sel.length) return
      pushHistory()
      const map = new Map<string, string>()
      const copies = sel.map((n): BzNode => {
        const id = newId()
        map.set(n.id, id)
        return { ...n, id, selected: true, position: { x: n.position.x + 32, y: n.position.y + 32 }, data: { ...n.data, params: { ...n.data.params } } }
      })
      const inner = edges
        .filter((e) => map.has(e.source) && map.has(e.target))
        .map((e): BzEdge => ({ ...e, id: `e${newId()}`, source: map.get(e.source)!, target: map.get(e.target)!, selected: false }))
      set({ nodes: [...nodes.map((n) => ({ ...n, selected: false })), ...copies], edges: [...edges, ...inner] })
      scheduleEval()
    },

    selectAll: () => set({ nodes: get().nodes.map((n) => ({ ...n, selected: true })) }),

    bump: (id) => {
      ticks[id] = (ticks[id] ?? 0) + 1
      scheduleEval()
    },

    commit: () => {},

    undo: () => {
      const { past, future } = get()
      if (!past.length) return
      const prev = past[past.length - 1]
      set({ past: past.slice(0, -1), future: [snapshot(), ...future].slice(0, MAX_HISTORY), nodes: prev.nodes, edges: prev.edges, dirty: true })
      lastParamEdit = null
      scheduleEval()
    },

    redo: () => {
      const { past, future } = get()
      if (!future.length) return
      const next = future[0]
      set({ future: future.slice(1), past: [...past, snapshot()].slice(-MAX_HISTORY), nodes: next.nodes, edges: next.edges, dirty: true })
      lastParamEdit = null
      scheduleEval()
    },

    autoLayout: (record = true) => {
      const { nodes, edges } = get()
      if (!nodes.length) return
      if (record) pushHistory()
      // longest-path layering, then stack each column
      const depth = new Map<string, number>()
      const visit = (id: string, seen: Set<string>): number => {
        if (depth.has(id)) return depth.get(id)!
        if (seen.has(id)) return 0
        seen.add(id)
        const d = Math.max(-1, ...edges.filter((e) => e.target === id).map((e) => visit(e.source, seen))) + 1
        depth.set(id, d)
        return d
      }
      nodes.forEach((n) => visit(n.id, new Set()))
      const cols = new Map<number, BzNode[]>()
      nodes.forEach((n) => {
        const d = depth.get(n.id) ?? 0
        if (!cols.has(d)) cols.set(d, [])
        cols.get(d)!.push(n)
      })
      const placed = new Map<string, { x: number; y: number }>()
      for (const [d, list] of [...cols.entries()].sort((a, b) => a[0] - b[0])) {
        list.sort((a, b) => a.position.y - b.position.y)
        let y = 64
        for (const n of list) {
          placed.set(n.id, { x: 64 + d * 360, y })
          y += (n.measured?.height ?? nodeHeightEstimate(n)) + 48
        }
      }
      set({ nodes: nodes.map((n) => ({ ...n, position: placed.get(n.id) ?? n.position })) })
    },

    newProject: () => {
      get().load({ format: "bazkia", version: 1, name: "Untitled", nodes: [], edges: [] })
    },

    load: (p) => {
      for (const k of Object.keys(ticks)) delete ticks[k]
      cache.clear()
      const nodes: BzNode[] = p.nodes.map((n) => {
        const def = getTool(n.tool)
        return {
          id: n.id,
          type: "tool",
          position: { x: n.x, y: n.y },
          data: { tool: n.tool, label: n.label, params: { ...(def ? defaultParams(def.params) : {}), ...n.params } },
        }
      })
      const edges: BzEdge[] = p.edges.map((e) => ({ ...e, type: "step" }))
      set({ name: p.name || "Untitled", nodes, edges, past: [], future: [], results: {}, dirty: false })
      lastParamEdit = null
      scheduleEval(0)
    },

    serialize: () => ({
      format: "bazkia",
      version: 1,
      name: get().name,
      nodes: get().nodes.map((n) => ({ id: n.id, tool: n.data.tool, x: n.position.x, y: n.position.y, params: n.data.params, label: n.data.label })),
      edges: get().edges.map((e) => ({ id: e.id, source: e.source, sourceHandle: e.sourceHandle ?? "", target: e.target, targetHandle: e.targetHandle ?? "" })),
    }),

    setName: (name) => set({ name, dirty: true }),
    markSaved: () => set({ dirty: false }),
    set: (patch) => set(patch as Partial<State>),

    notify: (text, kind = "info") => {
      const id = Date.now()
      set({ toast: { id, kind, text } })
      setTimeout(() => {
        if (get().toast?.id === id) set({ toast: null })
      }, 3500)
    },
  }

  function pushHistoryBeforeChange(changes: NodeChange<BzNode>[]) {
    // Node removals via keyboard arrive here; drags end here. The pre-change state
    // is what we want, so take the snapshot before applying.
    if (changes.some((c) => c.type === "remove") || changes.some((c) => c.type === "position" && c.dragging === false)) {
      const dragStart = dragSnapshot
      if (dragStart && changes.some((c) => c.type === "position")) {
        set({ past: [...get().past, dragStart].slice(-MAX_HISTORY), future: [], dirty: true })
      } else pushHistory()
      dragSnapshot = null
    }
  }
})

let lastParamEdit: { id: string; key: string; at: number } | null = null
let dragSnapshot: Snapshot | null = null

/** Called by the canvas when a drag starts, so undo restores the pre-drag position. */
export function beginDrag() {
  const s = useStore.getState()
  dragSnapshot = {
    nodes: s.nodes.map((n) => ({ ...n, selected: false, data: { ...n.data, params: { ...n.data.params } } })),
    edges: s.edges.map((e) => ({ ...e, selected: false })),
  }
}

export function nodeHeightEstimate(n: BzNode): number {
  const def = getTool(n.data.tool)
  if (!def) return 96
  const rows = Math.max(def.inputs.length, def.outputs.length)
  const params = def.params.slice(0, 4).reduce((h, p) => h + (p.type === "textarea" ? 88 : 56), 0)
  return 48 + rows * 24 + params + (def.display ? 120 : 24)
}

/** Debounced re-evaluation; supersedes any pass in flight. */
export function scheduleEval(delay = 24) {
  clearTimeout(timer)
  timer = setTimeout(runEval, delay)
}

async function runEval() {
  abort?.abort()
  const ctl = new AbortController()
  abort = ctl
  const { nodes, edges } = useStore.getState()
  syncLive(nodes)
  const t0 = performance.now()
  useStore.setState({ evaluating: true })
  try {
    const results = await evaluate(
      nodes.map((n) => ({ id: n.id, tool: n.data.tool, params: n.data.params })),
      edges.map((e) => ({ id: e.id, source: e.source, sourceHandle: e.sourceHandle, target: e.target, targetHandle: e.targetHandle })),
      { ticks, cache, signal: ctl.signal },
    )
    if (abort === ctl) {
      // drop cache entries of deleted nodes
      const ids = new Set(nodes.map((n) => n.id))
      for (const k of cache.keys()) if (!ids.has(k)) cache.delete(k)
      useStore.setState({ results, evaluating: false, evalMs: performance.now() - t0 })
    }
  } catch (err) {
    if (!(err instanceof DOMException && err.name === "AbortError")) {
      console.error(err)
      if (abort === ctl) useStore.setState({ evaluating: false })
    }
  }
}

/** Keeps one interval per live node (counter, clock, TOTP) in step with the graph. */
function syncLive(nodes: BzNode[]) {
  const wanted = new Map<string, number>()
  for (const n of nodes) {
    const ms = getTool(n.data.tool)?.live?.(n.data.params)
    if (ms) wanted.set(n.id, ms)
  }
  for (const [id, cur] of intervals) {
    if (wanted.get(id) !== cur.ms) {
      clearInterval(cur.handle)
      intervals.delete(id)
    }
  }
  for (const [id, ms] of wanted) {
    if (intervals.has(id)) continue
    intervals.set(id, {
      ms,
      handle: setInterval(() => {
        ticks[id] = (ticks[id] ?? 0) + 1
        scheduleEval(0)
      }, ms),
    })
  }
}

// ---- persistence ----
const AUTOSAVE = "bazkia:autosave"
let saveTimer: ReturnType<typeof setTimeout> | undefined

export function loadAutosave(): ProjectFile | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE)
    if (!raw) return null
    const p = JSON.parse(raw) as ProjectFile
    return p.format === "bazkia" ? p : null
  } catch {
    return null
  }
}

useStore.subscribe((s, prev) => {
  if (s.nodes === prev.nodes && s.edges === prev.edges && s.name === prev.name) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(AUTOSAVE, JSON.stringify(useStore.getState().serialize()))
    } catch { /* quota or private mode: autosave is best effort */ }
  }, 600)
})

export function applyTheme(pref: ThemePref) {
  const root = document.documentElement
  if (pref === "system") root.removeAttribute("data-theme")
  else root.setAttribute("data-theme", pref)
  try {
    localStorage.setItem(THEME_KEY, pref)
  } catch { /* ignore */ }
}
