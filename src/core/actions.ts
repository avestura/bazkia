import { applyTheme, useStore, type ThemePref } from "./store"
import { openProject, saveProject } from "./files"

let currentPath: string | null = null

const err = (e: unknown) => (e instanceof Error ? e.message : String(e))

export async function actionSave(as = false) {
  const s = useStore.getState()
  try {
    const path = await saveProject(s.serialize(), as, currentPath)
    if (path) {
      currentPath = path
      s.markSaved()
      s.notify(`Saved ${path.split(/[\\/]/).pop()}`, "success")
    }
  } catch (e) {
    s.notify(`Save failed: ${err(e)}`, "danger")
  }
}

export async function actionOpen() {
  const s = useStore.getState()
  try {
    const r = await openProject()
    if (r) {
      currentPath = r.path
      s.load(r.project)
      s.notify(`Opened ${r.path.split(/[\\/]/).pop()}`, "success")
    }
  } catch (e) {
    s.notify(`Open failed: ${err(e)}`, "danger")
  }
}

export function actionNew() {
  const s = useStore.getState()
  if (s.dirty && s.nodes.length && !window.confirm("Discard unsaved changes?")) return
  currentPath = null
  s.newProject()
}

export function cycleTheme() {
  const order: ThemePref[] = ["system", "light", "dark"]
  const s = useStore.getState()
  const next = order[(order.indexOf(s.theme) + 1) % order.length]
  applyTheme(next)
  s.set({ theme: next })
}

export function forgetPath() {
  currentPath = null
}
