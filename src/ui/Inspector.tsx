import { useMemo, useState } from "react"
import { getTool } from "../core/registry"
import { useStore } from "../core/store"
import { IN, OUT, PARAM } from "../core/types"
import type { Value } from "../core/types"
import { preview } from "../core/values"
import { Icon } from "./Icon"
import { ParamControl } from "./ParamControl"
import { ModeSwitch, ValueView, type ViewMode } from "./ValueView"

const SHORTCUTS: [string, string][] = [
  ["Ctrl K", "Search tools and actions"],
  ["Ctrl Z / Y", "Undo / redo"],
  ["Ctrl D", "Duplicate selection"],
  ["Del", "Delete selection"],
  ["Ctrl A", "Select all"],
  ["Ctrl S", "Save project"],
  ["Ctrl O", "Open project"],
  ["Space + drag", "Pan the canvas"],
  ["Link to empty space", "Add and connect a tool"],
]

const gap8 = { ["--bx-gap" as string]: "8px" }

export function Inspector() {
  const nodes = useStore((s) => s.nodes)
  const selected = nodes.filter((n) => n.selected)
  if (selected.length === 1) return <NodeInspector id={selected[0].id} key={selected[0].id} />
  return (
    <aside className="bz-inspector" aria-label="Inspector">
      <header className="bz-inspector__head">
        <p className="bx-label">{selected.length > 1 ? "Selection" : "Project"}</p>
        <h2>{selected.length > 1 ? `${selected.length} nodes selected` : "Nothing selected"}</h2>
      </header>
      {selected.length > 1 ? (
        <div className="bz-inspector__body">
          <div className="bx-cluster" style={gap8}>
            <button className="bx-btn" onClick={() => useStore.getState().duplicateSelected()}>
              <Icon name="copy" />
              Duplicate
            </button>
            <button className="bx-btn bx-btn--danger" onClick={() => useStore.getState().removeSelected()}>
              <Icon name="trash" />
              Delete
            </button>
          </div>
        </div>
      ) : (
        <div className="bz-inspector__body">
          <p className="bz-muted">
            Select a node to see its parameters, inputs and full output. Any parameter can be wired: drag a link onto the small square at its left edge.
          </p>
          <p className="bx-label">Shortcuts</p>
          <dl className="bz-shortcuts">
            {SHORTCUTS.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </aside>
  )
}

function NodeInspector({ id }: { id: string }) {
  const node = useStore((s) => s.nodes.find((n) => n.id === id))
  const result = useStore((s) => s.results[id])
  const edges = useStore((s) => s.edges)
  const results = useStore((s) => s.results)
  const setParam = useStore((s) => s.setParam)
  const setLabel = useStore((s) => s.setLabel)
  const notify = useStore((s) => s.notify)
  const [modes, setModes] = useState<Record<string, ViewMode>>({})
  const def = node ? getTool(node.data.tool) : undefined

  const wired = useMemo(() => {
    const m: Record<string, string> = {}
    for (const e of edges) {
      if (e.target !== id || !e.targetHandle?.startsWith(PARAM)) continue
      m[e.targetHandle.slice(PARAM.length)] = preview(results[e.source]?.outputs[e.sourceHandle?.slice(OUT.length) ?? ""], 60)
    }
    return m
  }, [edges, results, id])

  const inputs = useMemo(() => {
    const m: Record<string, Value> = {}
    for (const e of edges) {
      if (e.target === id && e.targetHandle?.startsWith(IN)) m[e.targetHandle.slice(IN.length)] = results[e.source]?.outputs[e.sourceHandle?.slice(OUT.length) ?? ""]
    }
    return m
  }, [edges, results, id])

  if (!node || !def) return null
  const copied = (ok: boolean) => notify(ok ? "Copied" : "Copy failed", ok ? "success" : "danger")

  return (
    <aside className="bz-inspector" aria-label="Inspector">
      <header className="bz-inspector__head">
        <p className="bx-label">{def.category}</p>
        <h2>{def.name}</h2>
        <p className="bz-muted">{def.description}</p>
      </header>
      <div className="bz-inspector__body">
        <div className="bx-field">
          <label className="bx-label" htmlFor="insp-label">
            Label
          </label>
          <input
            id="insp-label"
            className="bx-input"
            placeholder={def.name}
            value={node.data.label ?? ""}
            onChange={(e) => setLabel(id, e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>

        {def.params.length > 0 && <p className="bx-label bz-inspector__section">Parameters</p>}
        {def.params.map((p) => (
          <div className="bx-field" key={p.id}>
            <label className="bx-label" htmlFor={`insp-${p.id}`}>
              {p.label}
            </label>
            <ParamControl def={p} id={`insp-${p.id}`} value={node.data.params[p.id]} onChange={(v) => setParam(id, p.id, v)} wired={wired[p.id]} />
            {p.help && <p className="bz-muted bz-help">{p.help}</p>}
          </div>
        ))}

        {result?.error && (
          <div className="bx-callout bx-callout--danger" role="alert">
            <strong>Failed</strong>
            <p>{result.error}</p>
          </div>
        )}

        {def.inputs.length > 0 && <p className="bx-label bz-inspector__section">Inputs</p>}
        {def.inputs.map((p) => (
          <div key={p.id} className="bz-io">
            <p className="bz-io__name">
              {p.label}
              {!(p.id in inputs) && <span className="bz-muted"> · not connected</span>}
            </p>
            {p.id in inputs && <ValueView value={inputs[p.id]} maxHeight={120} onCopied={copied} />}
          </div>
        ))}

        {def.outputs.length > 0 && !def.annotation && <p className="bx-label bz-inspector__section">Outputs</p>}
        {def.outputs.map((p) => (
          <div key={p.id} className="bz-io">
            <div className="bz-io__head">
              <p className="bz-io__name">{p.label}</p>
              <ModeSwitch mode={modes[p.id] ?? "auto"} onChange={(m) => setModes((s) => ({ ...s, [p.id]: m }))} />
            </div>
            <ValueView value={result?.outputs[p.id]} mode={modes[p.id] ?? "auto"} maxHeight={240} onCopied={copied} />
          </div>
        ))}
        {result && !def.annotation && <p className="bz-muted bz-timing">{result.ms < 1 ? "<1" : result.ms.toFixed(1)} ms</p>}

        <div className="bx-cluster bz-inspector__actions" style={gap8}>
          <button className="bx-btn" onClick={() => useStore.getState().duplicateSelected()}>
            <Icon name="copy" />
            Duplicate
          </button>
          <button className="bx-btn bx-btn--danger" onClick={() => useStore.getState().removeSelected()}>
            <Icon name="trash" />
            Delete
          </button>
        </div>
      </div>
    </aside>
  )
}
