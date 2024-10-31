import { FromBase64DataDevTool } from "./data/fromBase64"
import { ToBase64DataDevTool } from "./data/toBase64"
import { DevTool } from "./DevTool"
import { DevToolId } from "./devtools"
import { BillboardDisplayDevTool } from "./display/billboard"
import { CounterInputDevTool } from "./input/counter"
import { DeboucnerInputDevTool } from "./input/debouncer"
import { PlainTextInputDevTool } from "./input/plain"

export const createDevToolById: (toolId: DevToolId) => DevTool = (toolID) => {
    const mapping = {
        "input:plainText": new PlainTextInputDevTool(),
        "input:counter": new CounterInputDevTool(),
        "input:debouncer": new DeboucnerInputDevTool(),
        "data:toBase64": new ToBase64DataDevTool(),
        "data:fromBase64": new FromBase64DataDevTool(),
        "display:billboard": new BillboardDisplayDevTool(),
    } as const;
    return mapping[toolID]
}