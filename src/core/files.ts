import type { ProjectFile } from "./types"

const inTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window

export function parseProject(text: string): ProjectFile {
  const p = JSON.parse(text) as ProjectFile
  if (p?.format !== "bazkia" || !Array.isArray(p.nodes) || !Array.isArray(p.edges)) throw new Error("Not a Bazkia project file")
  return p
}

const safeName = (n: string) => (n.trim() || "Untitled").replace(/[\/:*?"<>|]+/g, "-")

/** Returns the saved path (desktop) or file name (browser), or null if cancelled. */
export async function saveProject(p: ProjectFile, as: boolean, currentPath?: string | null): Promise<string | null> {
  const text = JSON.stringify(p, null, 2)
  if (inTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog")
    const { writeTextFile } = await import("@tauri-apps/plugin-fs")
    const path = !as && currentPath ? currentPath : await save({ defaultPath: `${safeName(p.name)}.bazkia.json`, filters: [{ name: "Bazkia project", extensions: ["json"] }] })
    if (!path) return null
    await writeTextFile(path, text)
    return path
  }
  const blob = new Blob([text], { type: "application/json" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `${safeName(p.name)}.bazkia.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  return a.download
}

export async function openProject(): Promise<{ project: ProjectFile; path: string } | null> {
  if (inTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog")
    const { readTextFile } = await import("@tauri-apps/plugin-fs")
    const path = await open({ multiple: false, filters: [{ name: "Bazkia project", extensions: ["json"] }] })
    if (!path || Array.isArray(path)) return null
    return { project: parseProject(await readTextFile(path)), path }
  }
  return new Promise((resolve, reject) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json,application/json"
    input.onchange = async () => {
      const f = input.files?.[0]
      if (!f) return resolve(null)
      try {
        resolve({ project: parseProject(await f.text()), path: f.name })
      } catch (e) {
        reject(e)
      }
    }
    input.click()
  })
}

export async function openExternal(url: string) {
  if (inTauri()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener")
    await openUrl(url)
  } else window.open(url, "_blank", "noopener")
}
