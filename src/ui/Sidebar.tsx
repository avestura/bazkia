import { useReactFlow } from "@xyflow/react"
import { useMemo, useState } from "react"
import { categories, searchTools } from "../core/registry"
import { useStore } from "../core/store"
import type { ToolDef } from "../core/types"
import { DND_TYPE } from "./Canvas"
import { CATEGORY_ICON, Icon } from "./Icon"

export function Sidebar() {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState<Set<string>>(() => new Set(["Input", "Output"]))
  const addNode = useStore((s) => s.addNode)
  const rf = useReactFlow()
  const cats = useMemo(() => categories(), [])
  const hits = useMemo(() => (query.trim() ? searchTools(query, 80) : null), [query])

  const add = (t: ToolDef) => {
    const c = rf.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    addNode(t.id, { x: c.x - 128 + Math.random() * 64, y: c.y - 64 + Math.random() * 64 })
  }

  const row = (t: ToolDef) => (
    <li key={t.id}>
      <button
        className="bz-tool"
        draggable
        title={t.description}
        onClick={() => add(t)}
        onDragStart={(e) => {
          e.dataTransfer.setData(DND_TYPE, t.id)
          e.dataTransfer.effectAllowed = "copy"
        }}
      >
        <span>{t.name}</span>
        <Icon name="plus" size="sm" />
      </button>
    </li>
  )

  return (
    <aside className="bz-sidebar" aria-label="Tool library">
      <div className="bz-sidebar__search">
        <div className="bx-search bx-search--sm">
          <Icon name="search" />
          <input
            className="bx-input"
            placeholder="Filter tools"
            aria-label="Filter tools"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === "Enter" && hits?.[0]) add(hits[0])
              if (e.key === "Escape") setQuery("")
            }}
          />
        </div>
      </div>
      <nav className="bz-sidebar__list">
        {hits ? (
          hits.length ? (
            <ul className="bz-toollist">{hits.map(row)}</ul>
          ) : (
            <p className="bz-sidebar__none">Nothing matches &ldquo;{query}&rdquo;.</p>
          )
        ) : (
          cats.map((c) => {
            const isOpen = open.has(c.name)
            return (
              <section key={c.name}>
                <button
                  className="bz-cat"
                  aria-expanded={isOpen}
                  onClick={() =>
                    setOpen((o) => {
                      const n = new Set(o)
                      if (n.has(c.name)) n.delete(c.name)
                      else n.add(c.name)
                      return n
                    })
                  }
                >
                  <Icon name={CATEGORY_ICON[c.name] ?? "grid"} />
                  <span>{c.name}</span>
                  <span className="bz-cat__count">{c.tools.length}</span>
                  <Icon name={isOpen ? "up" : "down"} size="sm" />
                </button>
                {isOpen && <ul className="bz-toollist">{c.tools.map(row)}</ul>}
              </section>
            )
          })
        )}
      </nav>
    </aside>
  )
}
