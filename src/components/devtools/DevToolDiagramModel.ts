import { CanvasModelOptions, DiagramModel, DiagramModelGenerics } from "@projectstorm/react-diagrams";

export class DevToolDiagramModel extends DiagramModel<DiagramModelGenerics> {
    forceRefresh?: () => void
    constructor(options?: CanvasModelOptions, forceRefresh?: () => void) {
        super(options)
        this.forceRefresh = forceRefresh
    }

    setForceRefresh(action: typeof this.forceRefresh) {
        this.forceRefresh = action
    }
}