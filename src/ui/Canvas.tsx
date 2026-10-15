import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type OnConnectEnd,
} from "@xyflow/react"
import { useCallback, useEffect, useRef } from "react"
import { useMarquee } from "./useMarquee"
import { parseProject } from "../core/files"
import { beginDrag, useStore } from "../core/store"
import { ToolNode } from "./ToolNode"

const nodeTypes = { tool: ToolNode }
const defaultEdgeOptions = { type: "step" as const }

// Props that React Flow compares by reference must be stable. Fresh array and object literals
// on every render make it re-apply them to its store each time, which re-renders every node.
const SNAP_GRID: [number, number] = [8, 8]
const PAN_BUTTONS = [1, 2]
const MULTI_SELECT_KEYS = ["Shift", "Meta", "Control"]
const PRO_OPTIONS = { hideAttribution: true }
const MINIMAP_STYLE = { width: 160, height: 104 }

export const DND_TYPE = "application/x-bazkia-tool"

export function Canvas() {
  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  const onNodesChange = useStore((s) => s.onNodesChange)
  const onEdgesChange = useStore((s) => s.onEdgesChange)
  const onConnect = useStore((s) => s.onConnect)
  const isValidConnection = useStore((s) => s.isValidConnection)
  const rf = useReactFlow()
  const loadedFor = useRef<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const marquee = useRef<HTMLDivElement>(null)
  useMarquee(root, marquee)
  const name = useStore((s) => s.name)
  const empty = nodes.length === 0

  // Frame the graph whenever a different project is loaded.
  useEffect(() => {
    const key = `${name}:${empty}`
    if (loadedFor.current === key) return
    loadedFor.current = key
    const t = setTimeout(() => rf.fitView({ padding: 0.2, maxZoom: 1, duration: 0 }), 50)
    return () => clearTimeout(t)
  }, [name, empty, rf])

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, state) => {
      if (state.isValid || state.toNode || !state.fromNode || !state.fromHandle) return
      const pt = "changedTouches" in event ? event.changedTouches[0] : (event as MouseEvent)
      const pos = rf.screenToFlowPosition({ x: pt.clientX, y: pt.clientY })
      useStore.setState({
        pendingConnect: {
          nodeId: state.fromNode.id,
          handleId: state.fromHandle.id ?? "",
          handleType: state.fromHandle.type,
          x: pos.x,
          y: pos.y,
        },
        paletteOpen: true,
      })
    },
    [rf],
  )

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      const tool = e.dataTransfer.getData(DND_TYPE)
      if (tool) {
        useStore.getState().addNode(tool, rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }))
        return
      }
      const f = e.dataTransfer.files?.[0]
      if (f) {
        try {
          useStore.getState().load(parseProject(await f.text()))
          useStore.getState().notify(`Opened ${f.name}`, "success")
        } catch (err) {
          useStore.getState().notify(err instanceof Error ? err.message : "Could not open file", "danger")
        }
      }
    },
    [rf],
  )

  return (
    <div
      ref={root}
      className="bz-canvas"
      onDrop={onDrop}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = "copy"
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        isValidConnection={isValidConnection}
        onNodeDragStart={beginDrag}
        onSelectionDragStart={beginDrag}
        connectionMode={ConnectionMode.Strict}
        snapToGrid
        snapGrid={SNAP_GRID}
        deleteKeyCode={null}
        selectionOnDrag={false}
        panOnDrag={PAN_BUTTONS}
        panActivationKeyCode="Space"
        multiSelectionKeyCode={MULTI_SELECT_KEYS}
        minZoom={0.1}
        maxZoom={2}
        proOptions={PRO_OPTIONS}
        elevateEdgesOnSelect
      >
        <Background id="minor" variant={BackgroundVariant.Lines} gap={8} lineWidth={1} className="bz-grid-minor" />
        <Background id="major" variant={BackgroundVariant.Lines} gap={64} lineWidth={1} className="bz-grid-major" />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap pannable zoomable position="bottom-right" nodeStrokeWidth={1} nodeBorderRadius={0} style={MINIMAP_STYLE} />
      </ReactFlow>
      <div ref={marquee} className="bz-marquee" hidden />
      {empty && (
        <div className="bz-empty">
          <p className="bx-label">00 / Empty canvas</p>
          <h2>Start with one tool.</h2>
          <p>
            Press <kbd className="bx-kbd">Ctrl</kbd> <kbd className="bx-kbd">K</kbd> to search every tool, drag one from the list, or open an example.
          </p>
          <div className="bx-cluster" style={{ ["--bx-gap" as string]: "8px" }}>
            <button className="bx-btn bx-btn--primary" onClick={() => useStore.setState({ examplesOpen: true })}>
              Open an example
            </button>
            <button className="bx-btn" onClick={() => useStore.setState({ paletteOpen: true })}>
              Add a tool
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
