import { ReactNode } from "react"
import { DevTool } from "../DevTool"
import { DevToolPortModel } from "../DevToolPortModel"

export class FromBase64DataDevTool extends DevTool<{ err: string }> {
    base64Port: DevToolPortModel
    textPort: DevToolPortModel
    constructor() {
        super("data", "fromBase64", {
            name: "Data: From Base64",
            color: "rgb(0,100,255)"
        })

        this.base64Port = this.addInPort("Base64")
        this.textPort = this.addOutPort("Text")
    }

    override renderConfiguration(): ReactNode {
        return <b>{this.getParamaeter("err")}</b>
    }

    calculateOutputs(): Record<string, any> {
        return {
            ["Text"]: (() => {
                    return atob(this.base64Port.getInPortValue())
            })()
        }
    }
}