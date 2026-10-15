import { Handle, Position, type NodeProps } from "@xyflow/react"
import { memo, useMemo } from "react"
import { getTool } from "../core/registry"
import { useStore, type BzNode } from "../core/store"
import { IN, OUT, PARAM } from "../core/types"
import { preview } from "../core/values"
import { Icon } from "./Icon"
import { ParamControl } from "./ParamControl"
import { ModeSwitch, ValueView, type ViewMode } from "./ValueView"

const INLINE_PARAMS = 4

function ToolNodeImpl({ id, data, selected }: NodeProps<BzNode>) {
  const def = getTool(data.tool)
  const result = useStore((s) => s.results[id])
  const edges = useStore((s) => s.edges)
  const results = useStore((s) => s.results)
  const setParam = useStore((s) => s.setParam)
  const bump = useStore((s) => s.bump)
  const notify = useStore((s) => s.notify)

  const wired = useMemo(() => {
    const m: Record<string, string> = {}
    for (const e of edges) {
      if (e.target !== id || !e.targetHandle?.startsWith(PARAM)) continue
      const v = results[e.source]?.outputs[e.sourceHandle?.slice(OUT.length) ?? ""]
      m[e.targetHandle.slice(PARAM.length)] = preview(v, 40)
    }
    return m
  }, [edges, results, id])

  const connectedIn = useMemo(() => new Set(edges.filter((e) => e.target === id && e.targetHandle?.startsWith(IN)).map((e) => e.targetHandle)), [edges, id])

  if (!def) {
    return (
      <div className="bz-node bz-node--error" data-selected={selected}>
        <header className="bz-node__head">
          <span className="bz-node__title">Unknown tool</span>
        </header>
        <p className="bz-node__error">“{data.tool}” is not available in this version.</p>
      </div>
    )
  }

  if (def.annotation) {
    return (
      <div className="bz-node bz-node--note" data-selected={selected}>
        <header className="bz-node__head">
          <span className="bz-node__cat">NOTE</span>
        </header>
        <textarea
          className="bx-textarea nodrag nowheel bz-note__text"
          value={String(data.params.text)}
          rows={3}
          onChange={(e) => setParam(id, "text", e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          aria-label="Note text"
        />
      </div>
    )
  }

  const rows = Math.max(def.inputs.length, def.outputs.length)
  const editable = def.params.filter((p) => !(def.display && p.id === "view"))
  const shown = editable.slice(0, INLINE_PARAMS)
  const hidden = editable.length - shown.length
  const err = result?.error
  const inputValue = def.display ? edges.filter((e) => e.target === id && e.targetHandle === `${IN}in`).map((e) => results[e.source]?.outputs[e.sourceHandle?.slice(OUT.length) ?? ""])[0] : undefined
  const displayMode = (data.params.view as ViewMode) ?? "auto"

  return (
    <div className="bz-node" data-selected={selected} data-error={!!err} data-live={!!def.live}>
      <header className="bz-node__head">
        <span className="bz-node__cat">{def.category}</span>
        {def.reroll && (
          <button className="bx-btn bx-btn--ghost bx-btn--sm bx-btn--icon nodrag" aria-label="Re-roll" title="Run again for a new value" onClick={() => bump(id)}>
            <Icon name="refresh" size="sm" />
          </button>
        )}
        {def.live && <span className="bz-node__live" title="Runs on a timer">live</span>}
        {err && <span className="bz-node__fault" title={err}><Icon name="error" size="sm" /></span>}
      </header>
      <div className="bz-node__title" title={def.description}>
        {data.label || def.name}
      </div>

      {rows > 0 && (
        <div className="bz-ports">
          {Array.from({ length: rows }, (_, i) => {
            const inp = def.inputs[i]
            const out = def.outputs[i]
            return (
              <div className="bz-ports__row" key={i}>
                <div className="bz-port bz-port--in">
                  {inp && (
                    <>
                      <Handle type="target" position={Position.Left} id={`${IN}${inp.id}`} className="bz-handle" data-linked={connectedIn.has(`${IN}${inp.id}`)} />
                      <span>{inp.label}</span>
                    </>
                  )}
                </div>
                <div className="bz-port bz-port--out">
                  {out && (
                    <>
                      <span>{out.label}</span>
                      <Handle type="source" position={Position.Right} id={`${OUT}${out.id}`} className="bz-handle" />
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {shown.length > 0 && (
        <div className="bz-params">
          {shown.map((p) => (
            <div className="bz-param" key={p.id} data-type={p.type}>
              <Handle type="target" position={Position.Left} id={`${PARAM}${p.id}`} className="bz-handle bz-handle--param" data-linked={p.id in wired} />
              <label className="bx-label" htmlFor={`${id}-${p.id}`}>
                {p.label}
              </label>
              <ParamControl def={p} id={`${id}-${p.id}`} value={data.params[p.id]} onChange={(v) => setParam(id, p.id, v)} wired={wired[p.id]} />
            </div>
          ))}
          {hidden > 0 && <p className="bz-node__more">+{hidden} more in the inspector</p>}
        </div>
      )}

      {err && <p className="bz-node__error">{err}</p>}

      {def.display ? (
        <div className="bz-node__view">
          <ValueView value={inputValue} mode={displayMode} maxHeight={200} onCopied={(ok) => notify(ok ? "Copied" : "Copy failed", ok ? "success" : "danger")} />
        </div>
      ) : (
        !err &&
        def.outputs.length > 0 && (
          <div className="bz-node__preview">
            {def.outputs.slice(0, 3).map((o) => {
              const v = result?.outputs[o.id]
              return (
                <div key={o.id} className="bz-preview" title={preview(v, 400)}>
                  <span className="bz-preview__label">{o.label}</span>
                  <span className="bz-preview__value">{v === undefined ? "…" : preview(v, 72) || "(empty)"}</span>
                </div>
              )
            })}
          </div>
        )
      )}
      {def.display && (
        <div className="bz-node__foot nodrag">
          <ModeSwitch mode={displayMode} onChange={(m) => setParam(id, "view", m)} />
        </div>
      )}
    </div>
  )
}

export const ToolNode = memo(ToolNodeImpl)
