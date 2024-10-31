import { ReactNode } from "react";
import { DevTool } from "../DevTool";
import { DevToolPortModel } from "../DevToolPortModel";

type PlainTextInputDevToolParams = {
    text: string
}

export class BillboardDisplayDevTool extends DevTool<PlainTextInputDevToolParams> {
    textPort: DevToolPortModel
    textOutputPort: DevToolPortModel
    constructor() {
        super("display", "billboard", {
            name: "Billboard",
            color: "rgb(255,255,255)",
        }, {
            canRename: false,
            panelDisplayName: "Billboard"
        })

        this.textPort = this.addInPort("Input")
        this.textOutputPort = this.addOutPort("Output")
    }

    override renderConfiguration(): ReactNode {
        return <p>Current Value: {this.textPort.getInPortValue()}</p>
    }

    override calculateOutputs(): Record<string, any> {
        this.options.name = this.textPort.getInPortValue()
        return {
            "Output": this.textPort.getInPortValue()
        }
    }
}