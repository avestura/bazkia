import { ReactNode } from "react";
import { DevTool } from "../DevTool";
import { DevToolPortModel } from "../DevToolPortModel";

type PlainTextInputDevToolParams = {
    debouncedInput: any
}

export class DeboucnerInputDevTool extends DevTool<PlainTextInputDevToolParams> {
    inputPort: DevToolPortModel
    outputPort: DevToolPortModel
    constructor() {
        super("input", "debouncer", {
            name: "Debouncer",
            color: "rgb(0,192,255)",
        }, {
            canRename: false,
            refreshCanvasOnCalculate: true
        })

        this.inputPort = this.addInPort("Input")
        this.outputPort = this.addOutPort("Output")

        this.setParamater("debouncedInput", undefined)
    }

    override renderConfiguration(): ReactNode {
        return <></> // <p>Current Value: {this.inputPort.getInPortValue()}</p>
    }

    debounce(func: Function, timeout = 300){
        let timer: number | undefined;
        return (...args: any[]) => {
            clearTimeout(timer);
            timer = setTimeout(() => { func.apply(this, args); }, timeout);
        };
    }

    debounceInput = this.debounce(() => {
        const portValue = this.inputPort.getInPortValue()
        const current = this.getParamaeter('debouncedInput')
        if(portValue !== current) {
            this.setParamater("debouncedInput", this.inputPort.getInPortValue())
        }
    })

    override calculateOutputs(): Record<string, any> {
        console.log('reclc')
        this.debounceInput()
        return {
            "Output": this.getParamaeter('debouncedInput')
        }
    }
}