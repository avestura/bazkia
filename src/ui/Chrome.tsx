import { useReactFlow } from "@xyflow/react"
import { allTools } from "../core/registry"
import { actionNew, actionOpen, actionSave, cycleTheme } from "../core/actions"
import { openExternal } from "../core/files"
import { EXAMPLES, exampleProject } from "../core/examples"
import { useStore } from "../core/store"
import { Icon } from "./Icon"

export const VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev"
export const REPO = "https://github.com/avestura/bazkia"

export function Toolbar() {
  const name = useStore((s) => s.name)
  const dirty = useStore((s) => s.dirty)
  const theme = useStore((s) => s.theme)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const setName = useStore((s) => s.setName)
  const rf = useReactFlow()

  return (
    <header className="bz-toolbar">
      <div className="bz-brand" aria-label="Bazkia">
        <svg className="bz-brand__mark" viewBox="0 0 16 16" aria-hidden="true">
          <rect x="1" y="1" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <rect x="5" y="5" width="6" height="6" fill="currentColor" />
        </svg>
        <span>BAZKIA</span>
      </div>
      <span className="bz-toolbar__rule" />
      <input
        className="bz-name"
        value={name}
        aria-label="Project name"
        spellCheck={false}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
      />
      {dirty && <span className="bz-dirty" title="Unsaved changes">edited</span>}
      <span className="bz-toolbar__spacer" />

      <div className="bx-btn-group">
        <button className="bx-btn bx-btn--sm bx-btn--icon" onClick={actionNew} aria-label="New project" title="New project"><Icon name="file" /></button>
        <button className="bx-btn bx-btn--sm bx-btn--icon" onClick={() => void actionOpen()} aria-label="Open project" title="Open (Ctrl O)"><Icon name="folder" /></button>
        <button className="bx-btn bx-btn--sm bx-btn--icon" onClick={() => void actionSave()} aria-label="Save project" title="Save (Ctrl S)"><Icon name="download" /></button>
      </div>
      <div className="bx-btn-group">
        <button className="bx-btn bx-btn--sm bx-btn--icon" disabled={!canUndo} onClick={() => useStore.getState().undo()} aria-label="Undo" title="Undo (Ctrl Z)"><Icon name="left" /></button>
        <button className="bx-btn bx-btn--sm bx-btn--icon" disabled={!canRedo} onClick={() => useStore.getState().redo()} aria-label="Redo" title="Redo (Ctrl Y)"><Icon name="right" /></button>
      </div>
      <button
        className="bx-btn bx-btn--sm"
        title="Arrange nodes left to right"
        onClick={() => {
          useStore.getState().autoLayout()
          setTimeout(() => rf.fitView({ padding: 0.2, maxZoom: 1, duration: 120 }), 50)
        }}
      >
        <Icon name="columns" />
        Arrange
      </button>
      <button className="bx-btn bx-btn--sm" onClick={() => useStore.setState({ examplesOpen: true })}>
        <Icon name="book" />
        Examples
      </button>
      <button className="bx-btn bx-btn--sm bx-btn--primary" onClick={() => useStore.setState({ paletteOpen: true })} title="Search tools and actions (Ctrl K)">
        <Icon name="search" />
        Search
        <kbd className="bz-kbd-inline">Ctrl K</kbd>
      </button>
      <button className="bx-btn bx-btn--sm bx-btn--icon bx-btn--ghost" onClick={cycleTheme} aria-label={`Theme: ${theme}`} title={`Theme: ${theme}. Click to change.`}>
        <Icon name={theme === "dark" ? "star" : theme === "light" ? "eye" : "gear"} />
      </button>
      <button className="bx-btn bx-btn--sm bx-btn--icon bx-btn--ghost" onClick={() => useStore.setState({ aboutOpen: true })} aria-label="About" title="About"><Icon name="info" /></button>
    </header>
  )
}

export function StatusBar() {
  const nodes = useStore((s) => s.nodes.length)
  const edges = useStore((s) => s.edges.length)
  const evaluating = useStore((s) => s.evaluating)
  const ms = useStore((s) => s.evalMs)
  const results = useStore((s) => s.results)
  const faults = Object.values(results).filter((r) => r.error).length
  return (
    <footer className="bz-status">
      <span>{nodes} nodes</span>
      <span>{edges} links</span>
      <span className={faults ? "bz-status__bad" : ""}>{faults ? `${faults} with errors` : "no errors"}</span>
      <span className="bz-toolbar__spacer" />
      <span>{evaluating ? "running…" : `ran in ${ms < 1 ? "<1" : ms.toFixed(0)} ms`}</span>
      <span>{allTools().length} tools</span>
      <span>v{VERSION}</span>
    </footer>
  )
}

export function Toast() {
  const t = useStore((s) => s.toast)
  if (!t) return null
  return (
    <div className="bx-toast-stack" role="status" aria-live="polite">
      <div className="bx-toast" style={{ borderInlineStartColor: t.kind === "danger" ? "var(--bx-danger)" : t.kind === "success" ? "var(--bx-success)" : undefined }}>
        <Icon name={t.kind === "danger" ? "error" : t.kind === "success" ? "success" : "info"} />
        <span>{t.text}</span>
      </div>
    </div>
  )
}

function Dialog({ title, label, onClose, children, wide }: { title: string; label: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <>
      <div className="bx-scrim" onClick={onClose} />
      <div className={`bx-dialog bz-dialog${wide ? " bz-dialog--wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} onKeyDown={(e) => e.key === "Escape" && onClose()}>
        <header className="bz-dialog__head">
          <div>
            <p className="bx-label">{label}</p>
            <h2>{title}</h2>
          </div>
          <button className="bx-btn bx-btn--ghost bx-btn--sm bx-btn--icon" onClick={onClose} aria-label="Close" autoFocus>
            <Icon name="x" />
          </button>
        </header>
        {children}
      </div>
    </>
  )
}

export function ExamplesDialog() {
  const open = useStore((s) => s.examplesOpen)
  const rf = useReactFlow()
  if (!open) return null
  const close = () => useStore.setState({ examplesOpen: false })
  return (
    <Dialog title="Examples" label="Start from a working graph" onClose={close} wide>
      <ul className="bz-examples">
        {EXAMPLES.map((ex, i) => (
          <li key={ex.id}>
            <button
              className="bz-example"
              onClick={() => {
                useStore.getState().load(exampleProject(ex))
                close()
                // positions in the example files are rough; settle them once real node sizes are known
                setTimeout(() => {
                  useStore.getState().autoLayout(false)
                  setTimeout(() => rf.fitView({ padding: 0.15, maxZoom: 1, duration: 0 }), 50)
                }, 150)
              }}
            >
              <span className="bz-example__n">{String(i + 1).padStart(2, "0")}</span>
              <span className="bz-example__t">{ex.title}</span>
              <span className="bz-example__b">{ex.blurb}</span>
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  )
}

export function AboutDialog() {
  const open = useStore((s) => s.aboutOpen)
  if (!open) return null
  const close = () => useStore.setState({ aboutOpen: false })
  return (
    <Dialog title="Bazkia" label={`Version ${VERSION}`} onClose={close}>
      <div className="bz-dialog__body">
        <p>Small developer tools you wire together. Each node does one thing; links carry the result to the next one, and everything recomputes as you type.</p>
        <p className="bz-muted">
          Nothing leaves your machine. Hashing, encryption and every other tool run locally. The tool set is modelled on the catalogue of{" "}
          <a href="https://cyberchef.io" onClick={(e) => { e.preventDefault(); void openExternal("https://cyberchef.io") }}>CyberChef</a>, reimplemented from scratch.
        </p>
        <div className="bx-cluster" style={{ ["--bx-gap" as string]: "8px" }}>
          <button className="bx-btn" onClick={() => void openExternal(REPO)}>
            <Icon name="branch" />
            Source on GitHub
          </button>
          <button className="bx-btn" onClick={() => void openExternal(`${REPO}/issues`)}>
            <Icon name="comment" />
            Report an issue
          </button>
        </div>
      </div>
    </Dialog>
  )
}
