import type { ParamDef, Params } from "../core/types"

interface Props {
  def: ParamDef
  value: Params[string]
  onChange: (v: Params[string]) => void
  id: string
  /** shown instead of the control when the parameter is fed by a link */
  wired?: string
}

/** One editable parameter. `nodrag nowheel` keep React Flow from stealing pointer and wheel events. */
export function ParamControl({ def, value, onChange, id, wired }: Props) {
  const stop = (e: React.KeyboardEvent) => e.stopPropagation()
  if (wired !== undefined) {
    return (
      <div className="bz-wired" title="Fed by a connection. Remove the link to edit.">
        <span className="bz-wired__tag">linked</span>
        <span className="bz-wired__value">{wired || "(empty)"}</span>
      </div>
    )
  }
  switch (def.type) {
    case "toggle":
      return (
        <input id={id} type="checkbox" className="bx-toggle nodrag" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
      )
    case "select":
      return (
        <select id={id} className="bx-select nodrag" value={String(value)} onChange={(e) => onChange(e.target.value)} onKeyDown={stop}>
          {def.options!.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )
    case "number":
      return (
        <input
          id={id}
          className="bx-input bx-mono nodrag"
          type="number"
          value={String(value)}
          min={def.min}
          max={def.max}
          step={def.step ?? 1}
          onChange={(e) => {
            const n = e.target.valueAsNumber
            if (!Number.isNaN(n)) onChange(n)
          }}
          onKeyDown={stop}
        />
      )
    case "textarea":
      return (
        <textarea
          id={id}
          className={`bx-textarea nodrag nowheel${def.mono ? " bx-mono" : ""}`}
          rows={def.rows ?? 4}
          value={String(value)}
          placeholder={def.placeholder}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={stop}
        />
      )
    default:
      return (
        <input
          id={id}
          className={`bx-input nodrag${def.mono ? " bx-mono" : ""}`}
          type="text"
          value={String(value)}
          placeholder={def.placeholder}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={stop}
        />
      )
  }
}
