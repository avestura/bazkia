import * as SRD from '@projectstorm/react-diagrams';
import { DevToolCategory, DevToolNameMapping, DevToolType } from './devtools';
import { ReactNode } from 'react';
import { DevToolPortModel } from './DevToolPortModel';
import { DevToolLinkModel } from './DevToolLinkModel';
import { DevToolDiagramModel } from './DevToolDiagramModel';

export type DevToolNodeModelsOptions = {
    canRename?: boolean,
    panelDisplayName?: string,
    refreshCanvasOnCalculate?: boolean
}

export class DevTool<InternalParameters extends Record<string, any> = any> extends SRD.DefaultNodeModel {
    #category: DevToolCategory
    #devToolType: DevToolType
    #toolOptions: DevToolNodeModelsOptions
    constructor(category: DevToolCategory,
        type: DevToolNameMapping[typeof category],
        nodeOptions: SRD.DefaultNodeModelOptions,
        toolOptions?: DevToolNodeModelsOptions)
    {
        super(nodeOptions)
        this.#category = category
        this.#devToolType = type
        
        this.options.extras = {
            parameters: {}
        }
        this.#toolOptions = toolOptions ?? {
            canRename: false,
        }
    }

    override addInPort(label: string, after = true) {
        const p = new DevToolPortModel({
            in: true,
            name: label,
            label: label,
            alignment: SRD.PortModelAlignment.LEFT
        });
        if (!after) {
            this.portsIn.splice(0, 0, p);
        }
        return this.addPort(p);
    }

    override addOutPort(label: string, after = true) {
        const p = new DevToolPortModel({
            in: false,
            name: label,
            label: label,
            alignment: SRD.PortModelAlignment.RIGHT
        });
        if (!after) {
            this.portsOut.splice(0, 0, p);
        }
        return this.addPort(p);
    }

    getParamaeter(paramName: keyof InternalParameters): InternalParameters[typeof paramName]  {
        return this.options.extras.parameters[paramName]
    }

    setParamater(paramName: keyof InternalParameters, value: InternalParameters[typeof paramName]) {
        this.options.extras.parameters[paramName] = value        
        this.forceRecalculate()
    }

    getCategory() {
        return this.#category
    }

    getToolType() {
        return this.#devToolType
    }

    renderConfiguration(): ReactNode {
        return <></>
    }

    getToolOptions(): DevToolNodeModelsOptions {
        return this.#toolOptions
    }

    portChanged(port: DevToolPortModel, side: "source" | "target") {
        this.forceRecalculate()
    }

    portDeleted(port: DevToolPortModel) {
        port.setInPortValue(undefined)
        this.forceRecalculate()
    }

    calculateOutputs(): Record<string, any> {
        return {}
    }

    forceRecalculate() {
        let outputs: ReturnType<typeof this.calculateOutputs> = {}
        try {
            outputs = this.calculateOutputs()
        } catch(err) {
            console.warn(`failed computing outputs for node ${this.#devToolType}: ${err}`)
            this.portsOut.map(p => {
                outputs[p.getName()] = undefined
            })
        }
        for(const outKey in outputs) {
            const outPort = this.getPort(outKey) as DevToolPortModel
            if(outPort && !outPort.getOptions().in) {
                Object.values(outPort.links).forEach((l) => {
                    const targetInPort = (l as DevToolLinkModel).getInPort() as DevToolPortModel
                    if(targetInPort) {
                        const parent = targetInPort.getParent() as DevTool
                        if(parent) {
                            targetInPort.setInPortValue(outputs[outKey])
                            parent.forceRecalculate()
                        }
                    }
                })
            }
        }
        if(this.#toolOptions.refreshCanvasOnCalculate) {
            const canvas = this.getParentCanvasModel() as DevToolDiagramModel;
            if(canvas && canvas?.forceRefresh) {
                canvas.forceRefresh()
            }
        }
    }
}