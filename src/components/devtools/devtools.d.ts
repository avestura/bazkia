import { BaseModelListener, DefaultPortModel } from "@projectstorm/react-diagrams"

export type DevToolNameMapping = {
    "input": "plainText" | "counter" | "debouncer",
    "data": "toBase64" | "fromBase64",
    "display": "billboard"
}

export type DevToolCategory = keyof DevToolNameMapping
export type DevToolType = DevToolNameMapping[DevToolCategory]

export type DevToolId = {
    [K in DevToolCategory]: `${K}:${DevToolNameMapping[K]}`
}[DevToolCategory]