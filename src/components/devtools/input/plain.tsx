import { DevTool } from "../DevTool";
import { DevToolPortModel } from "../DevToolPortModel";
import { PlainTextConfiguration } from "./configuration";

type PlainTextInputDevToolParams = {
    text: string
}

export class PlainTextInputDevTool extends DevTool<PlainTextInputDevToolParams> {
    textPort: DevToolPortModel
    constructor() {
        super("input", "plainText", {
            name: "Input: Plain Text",
            color: "rgb(0,192,255)",
        }, {
            canRename: true
        })

        this.textPort = this.addOutPort("Text")
        this.setParamater("text", "Hello World")
    }

    override renderConfiguration(): JSX.Element {
        return <PlainTextConfiguration devTool={this} />
    }    

    override calculateOutputs(): Record<string, any> {
        return {
            "Text": this.getParamaeter('text')
        }
    }
}