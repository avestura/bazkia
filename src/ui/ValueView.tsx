import { useMemo, useState } from "react"
import type { Value } from "../core/types"
import { hexOf, hexdump, isBytes, looksLikeText, toText } from "../core/values"
import { Icon } from "./Icon"

export type ViewMode = "auto" | "text" | "hex" | "dump"

const LIMIT = 20000

export function renderValue(v: Value, mode: ViewMode): { text: string; kind: string; size: string; truncated: boolean } {
  if (v === undefined || v === null) return { text: "", kind: "empty", size: "", truncated: false }
  let kind: string
  let size: string
  let text: string
  if (isBytes(v)) {
    kind = looksLikeText(v) ? "bytes · utf-8" : "bytes"
    size = `${v.length} B`
    const m = mode === "auto" ? (looksLikeText(v) ? "text" : "dump") : mode
    text = m === "text" ? toText(v) : m === "hex" ? hexOf(v.subarray(0, LIMIT), " ") : hexdump(v.subarray(0, LIMIT))
    return { text: text.length > LIMIT ? text.slice(0, LIMIT) : text, kind, size, truncated: text.length > LIMIT || v.length > LIMIT }
  }
  if (typeof v === "string") {
    kind = "text"
    size = `${[...v].length} ch`
    text = mode === "hex" ? hexOf(new TextEncoder().encode(v).subarray(0, LIMIT), " ") : mode === "dump" ? hexdump(new TextEncoder().encode(v).subarray(0, LIMIT)) : v
  } else {
    kind = typeof v === "number" ? "number" : typeof v === "boolean" ? "boolean" : "json"
    size = ""
    text = toText(v)
  }
  return { text: text.length > LIMIT ? text.slice(0, LIMIT) : text, kind, size, truncated: text.length > LIMIT }
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function ValueView({ value, mode = "auto", maxHeight = 160, onCopied }: { value: Value; mode?: ViewMode; maxHeight?: number; onCopied?: (ok: boolean) => void }) {
  const r = useMemo(() => renderValue(value, mode), [value, mode])
  return (
    <div className="bz-value nodrag nowheel">
      <div className="bz-value__meta">
        <span>{r.kind}</span>
        {r.size && <span>{r.size}</span>}
        {r.truncated && <span>truncated</span>}
        <button
          className="bx-btn bx-btn--ghost bx-btn--sm bx-btn--icon bz-value__copy"
          aria-label="Copy value"
          title="Copy value"
          onClick={async () => onCopied?.(await copyText(toText(value)))}
        >
          <Icon name="copy" size="sm" />
        </button>
      </div>
      <pre className="bz-value__body" style={{ maxHeight }}>
        {r.text === "" ? <span className="bz-value__empty">{value === undefined ? "no value" : "empty"}</span> : r.text}
      </pre>
    </div>
  )
}

export function ModeSwitch({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  const opts: [ViewMode, string][] = [["auto", "Auto"], ["text", "Text"], ["hex", "Hex"], ["dump", "Dump"]]
  const [name] = useState(() => `vm-${Math.random().toString(36).slice(2)}`)
  return (
    <fieldset className="bx-segmented nodrag" aria-label="View as">
      {opts.map(([m, label]) => (
        <label key={m}>
          <input type="radio" name={name} checked={mode === m} onChange={() => onChange(m)} />
          <span>{label}</span>
        </label>
      ))}
    </fieldset>
  )
}
