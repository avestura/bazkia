import { ReactFlowProvider } from "@xyflow/react"
import { useEffect } from "react"
import { actionOpen, actionSave } from "./core/actions"
import { exampleProject, EXAMPLES } from "./core/examples"
import { applyTheme, loadAutosave, useStore } from "./core/store"
import { Canvas } from "./ui/Canvas"
import { AboutDialog, ExamplesDialog, StatusBar, Toast, Toolbar } from "./ui/Chrome"
import { Inspector } from "./ui/Inspector"
import { Palette } from "./ui/Palette"
import { Sidebar } from "./ui/Sidebar"

function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)
}

export default function App() {
  const sidebarOpen = useStore((s) => s.sidebarOpen)
  const inspectorOpen = useStore((s) => s.inspectorOpen)

  useEffect(() => {
    applyTheme(useStore.getState().theme)
    const saved = loadAutosave()
    useStore.getState().load(saved ?? exampleProject(EXAMPLES[0]))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState()
      const mod = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      if (mod && k === "k") {
        e.preventDefault()
        s.set({ paletteOpen: !s.paletteOpen, pendingConnect: null })
        return
      }
      if (mod && k === "s") {
        e.preventDefault()
        void actionSave(e.shiftKey)
        return
      }
      if (mod && k === "o") {
        e.preventDefault()
        void actionOpen()
        return
      }
      if (isTyping(e.target) || s.paletteOpen) return
      if (mod && k === "z") {
        e.preventDefault()
        if (e.shiftKey) s.redo()
        else s.undo()
      } else if (mod && k === "y") {
        e.preventDefault()
        s.redo()
      } else if (mod && k === "d") {
        e.preventDefault()
        s.duplicateSelected()
      } else if (mod && k === "a") {
        e.preventDefault()
        s.selectAll()
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault()
        s.removeSelected()
      } else if (e.key === "Escape") {
        s.set({ examplesOpen: false, aboutOpen: false })
      } else if (e.key === "/" || (k === "a" && !mod && e.shiftKey)) {
        e.preventDefault()
        s.set({ paletteOpen: true })
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <ReactFlowProvider>
      <div className="bz-app" data-sidebar={sidebarOpen} data-inspector={inspectorOpen}>
        <Toolbar />
        {sidebarOpen && <Sidebar />}
        <main className="bz-main">
          <Canvas />
        </main>
        {inspectorOpen && <Inspector />}
        <StatusBar />
      </div>
      <Palette />
      <ExamplesDialog />
      <AboutDialog />
      <Toast />
    </ReactFlowProvider>
  )
}
