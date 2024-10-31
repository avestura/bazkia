import { useState } from "react";
import { DevTool } from "./DevTool"
import { useDesignerContext } from "../designer/designerContext";

export const useParameters: <T extends DevTool = DevTool>(devTool: T) => [
    getParameter: typeof DevTool["prototype"]["getParamaeter"],
    setParameter: typeof DevTool["prototype"]["setParamater"],
    refresh: () => void
] =
(devTool) => {
    const [state, setState] = useState<ReturnType<typeof devTool["getParamaeter"]>>(devTool.getOptions()?.extras?.parameters);
    
    const designer = useDesignerContext()

    return [
        p => state[p],
        (p, v) => {
            setState(s => ({ ...s, [p]: v}))
            devTool.setParamater(p, v)
            designer?.forceUpdate()
        },
        () => setState(devTool.getOptions()?.extras?.parameters)
    ]
}