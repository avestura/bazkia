import { useReactFlow } from "@xyflow/react"
import { useEffect, useRef } from "react"
import { useStore } from "../core/store"

/**
 * Rubber-band selection, drawn by hand instead of by React Flow's built-in box.
 *
 * - The box is a plain element moved with one DOM write per animation frame, never through
 *   React state, so a 1000 Hz mouse cannot make it fall behind or stutter.
 * - Edges are rounded to whole pixels so the hairline stays crisp instead of shimmering.
 * - The pane holds the pointer while dragging, so no event is lost when the cursor crosses a
 *   node or leaves the window.
 * - Selection changes are applied only when the set of touched nodes actually changes.
 */
export function useMarquee(container: React.RefObject<HTMLDivElement | null>, box: React.RefObject<HTMLDivElement | null>) {
  const rf = useReactFlow()
  const rfRef = useRef(rf)
  rfRef.current = rf

  useEffect(() => {
    const root = container.current
    const el = box.current
    if (!root || !el) return

    let space = false
    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (e.code === "Space") space = down
    }
    const kd = (e: KeyboardEvent) => onKey(e, true)
    const ku = (e: KeyboardEvent) => onKey(e, false)
    window.addEventListener("keydown", kd)
    window.addEventListener("keyup", ku)

    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement
      if (e.button !== 0 || space || !t.classList.contains("react-flow__pane")) return
      e.preventDefault()
      t.setPointerCapture(e.pointerId)

      const bounds = root.getBoundingClientRect()
      const sx = e.clientX - bounds.left
      const sy = e.clientY - bounds.top
      const additive = e.shiftKey || e.ctrlKey || e.metaKey
      const base = additive ? new Set(useStore.getState().nodes.filter((n) => n.selected).map((n) => n.id)) : new Set<string>()
      let cx = sx
      let cy = sy
      let frame = 0
      let moved = false
      let applied = ""

      if (!additive) useStore.getState().setSelection(base)

      const paint = () => {
        frame = 0
        const x0 = Math.round(Math.min(sx, cx))
        const y0 = Math.round(Math.min(sy, cy))
        const w = Math.max(1, Math.round(Math.abs(cx - sx)))
        const h = Math.max(1, Math.round(Math.abs(cy - sy)))
        el.style.transform = `translate(${x0}px, ${y0}px)`
        el.style.width = `${w}px`
        el.style.height = `${h}px`

        // Anything the box touches, in flow coordinates.
        const a = rfRef.current.screenToFlowPosition({ x: bounds.left + x0, y: bounds.top + y0 })
        const b = rfRef.current.screenToFlowPosition({ x: bounds.left + x0 + w, y: bounds.top + y0 + h })
        const hit = new Set(base)
        for (const n of rfRef.current.getNodes()) {
          const nw = n.measured?.width ?? 256
          const nh = n.measured?.height ?? 96
          if (n.position.x < b.x && n.position.x + nw > a.x && n.position.y < b.y && n.position.y + nh > a.y) hit.add(n.id)
        }
        const key = [...hit].sort().join("|")
        if (key !== applied) {
          applied = key
          useStore.getState().setSelection(hit)
        }
      }

      const onMove = (m: PointerEvent) => {
        cx = m.clientX - bounds.left
        cy = m.clientY - bounds.top
        if (!moved) {
          if (Math.abs(cx - sx) + Math.abs(cy - sy) < 4) return
          moved = true
          root.dataset.marquee = "true"
          el.hidden = false
        }
        if (!frame) frame = requestAnimationFrame(paint)
      }

      const finish = () => {
        t.removeEventListener("pointermove", onMove)
        t.removeEventListener("pointerup", finish)
        t.removeEventListener("pointercancel", finish)
        if (frame) cancelAnimationFrame(frame)
        if (moved) {
          paint()
          // The click that follows a drag would clear the selection we just made.
          window.addEventListener("click", (c) => c.stopPropagation(), { capture: true, once: true })
        }
        el.hidden = true
        delete root.dataset.marquee
        if (t.hasPointerCapture(e.pointerId)) t.releasePointerCapture(e.pointerId)
      }

      t.addEventListener("pointermove", onMove)
      t.addEventListener("pointerup", finish)
      t.addEventListener("pointercancel", finish)
    }

    root.addEventListener("pointerdown", onDown, true)
    return () => {
      root.removeEventListener("pointerdown", onDown, true)
      window.removeEventListener("keydown", kd)
      window.removeEventListener("keyup", ku)
    }
  }, [container, box])
}
