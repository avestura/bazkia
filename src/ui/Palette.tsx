import { useReactFlow } from "@xyflow/react"
import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { actionNew, actionOpen, actionSave, cycleTheme } from "../core/actions"
import { getTool, searchTools } from "../core/registry"
import { useStore } from "../core/store"
import { IN, OUT } from "../core/types"
import { Icon, type IconName } from "./Icon"

interface Item {
  key: string
  group: "Tools" | "Actions"
  label: string
  hint?: string
  icon: IconName
  run: () => void
}

export function Palette() {
  const open = useStore((s) => s.paletteOpen)
  if (!open) return null
  return <PaletteInner />
}

function PaletteInner() {
  const [q, setQ] = useState("")
  const [active, setActive] = useState(0)
  const rf = useReactFlow()
  const pending = useStore((s) => s.pendingConnect)
  const input = useRef<HTMLInputElement>(null)

  const close = () => useStore.setState({ paletteOpen: false, pendingConnect: null })

  useEffect(() => input.current?.focus(), [])

  const addTool = (id: string) => {
    const st = useStore.getState()
    const def = getTool(id)
    const at = pending ? { x: pending.x, y: pending.y } : rf.screenToFlowPosition({ x: window.innerWidth / 2 - 120, y: window.innerHeight / 2 - 80 })
    const nid = st.addNode(id, at)
    if (nid && def && pending) {
      if (pending.handleType === "source" && def.inputs[0]) {
        st.onConnect({ source: pending.nodeId, sourceHandle: pending.handleId, target: nid, targetHandle: `${IN}${def.inputs[0].id}` })
      } else if (pending.handleType === "target" && def.outputs[0]) {
        st.onConnect({ source: nid, sourceHandle: `${OUT}${def.outputs[0].id}`, target: pending.nodeId, targetHandle: pending.handleId })
      }
    }
    close()
  }

  const actions: Item[] = useMemo(
    () => [
      { key: "a:new", group: "Actions", label: "New project", icon: "file", run: actionNew },
      { key: "a:open", group: "Actions", label: "Open project…", hint: "Ctrl O", icon: "folder", run: () => void actionOpen() },
      { key: "a:save", group: "Actions", label: "Save project", hint: "Ctrl S", icon: "download", run: () => void actionSave() },
      { key: "a:saveas", group: "Actions", label: "Save project as…", icon: "download", run: () => void actionSave(true) },
      { key: "a:examples", group: "Actions", label: "Open an example", icon: "book", run: () => useStore.setState({ examplesOpen: true }) },
      { key: "a:undo", group: "Actions", label: "Undo", hint: "Ctrl Z", icon: "left", run: () => useStore.getState().undo() },
      { key: "a:redo", group: "Actions", label: "Redo", hint: "Ctrl Y", icon: "right", run: () => useStore.getState().redo() },
      { key: "a:layout", group: "Actions", label: "Auto-arrange nodes", icon: "columns", run: () => { useStore.getState().autoLayout(); setTimeout(() => rf.fitView({ padding: 0.2, maxZoom: 1, duration: 120 }), 50) } },
      { key: "a:fit", group: "Actions", label: "Fit graph to window", icon: "grid", run: () => rf.fitView({ padding: 0.2, maxZoom: 1, duration: 120 }) },
      { key: "a:theme", group: "Actions", label: "Cycle theme (system / light / dark)", icon: "eye", run: cycleTheme },
      { key: "a:sidebar", group: "Actions", label: "Toggle tool library", icon: "list", run: () => useStore.setState((s) => ({ sidebarOpen: !s.sidebarOpen })) },
      { key: "a:inspector", group: "Actions", label: "Toggle inspector", icon: "gear", run: () => useStore.setState((s) => ({ inspectorOpen: !s.inspectorOpen })) },
      { key: "a:about", group: "Actions", label: "About Bazkia", icon: "info", run: () => useStore.setState({ aboutOpen: true }) },
    ],
    [rf],
  )

  const items: Item[] = useMemo(() => {
    const tools: Item[] = searchTools(q, q.trim() ? 40 : 8).map((t) => ({
      key: t.id,
      group: "Tools",
      label: t.name,
      hint: t.category,
      icon: "plus",
      run: () => addTool(t.id),
    }))
    const needle = q.trim().toLowerCase()
    const acts = pending ? [] : actions.filter((a) => !needle || a.label.toLowerCase().includes(needle))
    return [...tools, ...acts]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, actions, pending])

  useEffect(() => setActive(0), [q])

  const onKey = (e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === "Escape") close()
    else if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((a) => Math.min(items.length - 1, a + 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const it = items[active]
      if (it) {
        if (it.group === "Actions") close()
        it.run()
      }
    }
  }

  useEffect(() => {
    document.getElementById(`pal-${active}`)?.scrollIntoView({ block: "nearest" })
  }, [active])

  let lastGroup = ""
  return (
    <>
      <div className="bx-scrim" onClick={close} />
      <div className="bx-dialog bx-dialog--palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="bx-palette__search">
          <Icon name="search" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder={pending ? "Choose a tool to connect…" : "Search tools and actions…"}
            role="combobox"
            aria-expanded="true"
            aria-controls="pal-list"
            aria-activedescendant={`pal-${active}`}
            spellCheck={false}
          />
          <kbd className="bx-kbd">Esc</kbd>
        </div>
        <div className="bx-palette__list" id="pal-list" role="listbox">
          {items.length === 0 && <p className="bz-sidebar__none">Nothing matches &ldquo;{q}&rdquo;.</p>}
          {items.map((it, i) => {
            const head = it.group !== lastGroup ? ((lastGroup = it.group), <div className="bx-palette__group">{it.group}</div>) : null
            return (
              <Fragment key={it.key}>
                {head}
                <div
                  id={`pal-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={`bx-palette__item${i === active ? " is-active" : ""}`}
                  onMouseMove={() => setActive(i)}
                  onClick={() => {
                    if (it.group === "Actions") close()
                    it.run()
                  }}
                >
                  <Icon name={it.icon} />
                  <span>{it.label}</span>
                  {it.hint && <span className="bx-palette__meta">{it.hint}</span>}
                </div>
              </Fragment>
            )
          })}
        </div>
      </div>
    </>
  )
}
