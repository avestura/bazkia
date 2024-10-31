import { DefaultLinkModel } from "@projectstorm/react-diagrams";
import { PortChangedEvent } from "../../utils/react-diagrams/events";
import { DevTool } from "./DevTool";
import { DevToolPortModel } from "./DevToolPortModel";
import { DevToolDiagramModel } from "./DevToolDiagramModel";

export class DevToolLinkModel extends DefaultLinkModel {
	previousSource?: DevTool
	previousSourcePort?: DevToolPortModel
	previousTarget?: DevTool
	previousTargetPort?: DevToolPortModel

	constructor() {
		super({
			type: 'devtool'
		});

		//@ts-expect-error
		this.registerListener({
			sourcePortChanged: (e: any) => {
				this.sourcePortChanged(e)
			},
			targetPortChanged: (e: any) =>{
				this.targetPortChanged(e)
			},
			entityRemoved: e => { this.entityRemoved(e) },
		})

		this
	}
	
	sourcePortChanged(event: PortChangedEvent) {
		const [_, thisRemoved] = this.deduplicateLinks()
		if(thisRemoved) {
			event.stopPropagation()
			return
		}
    	const sourceNode = event.port?.getParent() as DevTool;
    	if(sourceNode) {
			this.previousSource = sourceNode
			this.previousSourcePort = event.port as DevToolPortModel
        	sourceNode.portChanged(event.port as DevToolPortModel, "source")
		}
		const target = this.targetPort?.getParent() as DevTool;
		if(target && this.targetPort) {
			target.portChanged(this.targetPort as DevToolPortModel, "source")
		}
	}

	targetPortChanged(event: PortChangedEvent) {
		const [_, thisRemoved] = this.deduplicateLinks()
		if(thisRemoved) {
			event.stopPropagation()
			return 
		}
        const targetNode = event.port?.getParent() as DevTool;
        if(targetNode) {
			this.previousTarget = targetNode
			this.previousTargetPort = event.port as DevToolPortModel
            targetNode.portChanged(event.port as DevToolPortModel, "target")
        }
		const source = this.sourcePort?.getParent() as DevTool;
		if(source && this.sourcePort) {
			source.portChanged(this.sourcePort as DevToolPortModel, "source")
		}

	}

	deduplicateLinks(): [boolean, boolean] {
		let removed = false
		let thisRemoved = false
		const inPort = this.getInPort()
		if(inPort?.links) {
			const linkValues = Object.values(inPort.links)
			if(linkValues.length > 1) {
				linkValues.splice(1).forEach(lnk => {
					if(lnk.getID() === this.getID()) {
						thisRemoved = true;
					}
					removed = true;
					(lnk as DevToolLinkModel).remove()
				})
			}
		}
		if(removed) {
			const diagram = this.getParentCanvasModel() as DevToolDiagramModel
			if(diagram && diagram?.forceRefresh) {
				diagram.forceRefresh()
			}
		}
		return [removed, thisRemoved]
	}

	entityRemoved(_: any) {
		if(this.previousSource && this.previousSourcePort) {
			this.previousSource.portDeleted(this.previousSourcePort)
		}
		if(this.previousTarget && this.previousTargetPort) {
			this.previousTarget.portDeleted(this.previousTargetPort)
		}
	}

	getOutPort() {
		const sP = this.sourcePort as DevToolPortModel
		const tP = this.targetPort as DevToolPortModel
		if(sP && !sP.getOptions().in)
			return sP
		if(tP && !tP.getOptions().in)
			return tP
		return undefined
	}

	getInPort() {
		const sP = this.sourcePort as DevToolPortModel
		const tP = this.targetPort as DevToolPortModel
		if(sP && sP.getOptions().in)
			return sP
		if(tP && tP.getOptions().in)
			return tP
		return undefined

	}
}