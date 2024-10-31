import { ReactNode } from "react"
import { DevTool } from "../DevTool"
import { DevToolPortModel } from "../DevToolPortModel"

export class ToBase64DataDevTool extends DevTool<{ err: string }> {
    inputPort: DevToolPortModel
    base64Port: DevToolPortModel
    constructor() {
        super("data", "toBase64", {
            name: "Data: To Base64",
            color: "rgb(0,100,255)"
        })

        this.inputPort = this.addInPort("Input")
        this.base64Port = this.addOutPort("Base64")
    }

    override renderConfiguration(): ReactNode {
        return <b>{this.getParamaeter("err")}</b>
    }

    calculateOutputs(): Record<string, any> {
        return {
            ["Base64"]: (() => {
                try {
                    return btoa(this.inputPort.getInPortValue())
                }catch(err) {
                    this.setParamater("err", JSON.stringify(err))
                }
            })()
        }
    }
}