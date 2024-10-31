import { DevTool } from "../DevTool";
import { DevToolPortModel } from "../DevToolPortModel";
import { PlainTextConfiguration } from "./configuration";

type PlainTextInputDevToolParams = {
    count: number
}

export class CounterInputDevTool extends DevTool<PlainTextInputDevToolParams> {
    countPort: DevToolPortModel
    intervalId: number
    constructor() {
        super("input", "counter", {
            name: "Input: Counter",
            color: "rgb(0,192,255)",
        }, {
            canRename: true,
            refreshCanvasOnCalculate: true
        })

        this.countPort = this.addOutPort("Count")
        this.setParamater("count", 0)

        this.intervalId = setInterval(() => {
            this.setParamater("count", this.getParamaeter('count') + 1)
        }, 1000)
        this.registerListener({
            entityRemoved: (_: any) => clearInterval(this.intervalId),
        })
    }

    override calculateOutputs(): Record<string, any> {
        return {
            "Count": this.getParamaeter('count')
        }
    }

    
}