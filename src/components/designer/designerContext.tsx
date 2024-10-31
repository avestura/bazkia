import { createContext, ProviderProps, useContext, useEffect, useState } from "react"
import * as SRD from '@projectstorm/react-diagrams';
import { DevToolId } from "../devtools/devtools";
import { DevTool } from "../devtools/DevTool";
import { createDevToolById } from "../devtools/mapping";
import { DevToolLinkFactory } from "../devtools/DevToolLinkFactory";
import { DevToolDiagramModel } from "../devtools/DevToolDiagramModel";

export type DesignerContextData = {
    activeModel: DevToolDiagramModel,
    engine: SRD.DiagramEngine,
    setCurrentCanvas: (cavnas: SRD.CanvasWidget | null) => void,
    addDummyElements(listener?: SRD.BaseModelListener): void,
    introduceDevTool: (tool: DevToolId) => void,
    addDevTool: (tool: DevToolId, dragEvent?: React.DragEvent<HTMLElement>) => void,
    setGlobalModelListeners: (listener: SRD.BaseModelListener) => void,
    forceUpdate: () => void
}

const desingerContextDefaultValue: DesignerContextData = {
    engine: SRD.default(),
    activeModel: new DevToolDiagramModel(),
    addDummyElements: (_?: SRD.BaseModelListener) => {},
    setCurrentCanvas: () => {},
    introduceDevTool: () => {},
    addDevTool: () => {},
    setGlobalModelListeners: () => {},
    forceUpdate: () => {}
}

const DesignerContext = createContext<DesignerContextData>(desingerContextDefaultValue)

export const useDesignerContext = () => useContext(DesignerContext);

export type DesignerContextProviderProps = {
    children?: ProviderProps<DesignerContextData>["children"]
}

export type CanvasRefresher = () => void

export const DesignerContextProvider = ({ children }: DesignerContextProviderProps) => {
    const [engine, setEngine] = useState(SRD.default())
    const [activeModel, setActiveModel] = useState<DevToolDiagramModel>(new DevToolDiagramModel())
    const [canvas, setCanvas] = useState<SRD.CanvasWidget | undefined>(undefined)
    const [devTools, setDevTools] = useState<DevTool[]>([])
    const [globalListener, setListener] = useState<SRD.BaseModelListener>({})
    engine.setModel(activeModel)
    useEffect(() => {
        engine.setModel(activeModel)
        engine.getLinkFactories().registerFactory(new DevToolLinkFactory())
        
    }, [engine, activeModel])

    const addDevTool = (tool: DevToolId, event?: React.DragEvent<HTMLElement>) => {
        const node = createDevToolById(tool)
        if(!node)
            return;

        if(event) {
            var point = engine.getRelativeMousePoint(event);
            node.setPosition(point);
        } else {
            node.setPosition(100, 100)
        }

        const model = activeModel.addNode(node)

        if(globalListener) {
            model.registerListener(globalListener)
        }

        canvas?.forceUpdate()
    }

    const addDummyElemets = (listener?: SRD.BaseModelListener) => {
        var node1 = new SRD.DefaultNodeModel('Node 1', 'rgb(0,192,255)');
        
		let port = node1.addOutPort('Out');
		node1.setPosition(100, 100);

		//3-B) create another default node
		var node2 = new SRD.DefaultNodeModel('Node 2', 'rgb(192,255,0)');
		let port2 = node2.addInPort('In');
		node2.setPosition(400, 100);

		// link the ports
		let link1 = port.link(port2);

		const models = activeModel.addAll(node1, node2, link1);

        if(globalListener) {
            models.forEach(m => m.registerListener(globalListener))
        }
        if(listener) {
            models.forEach(m => {
                m.registerListener(listener)
            })
        }

        canvas?.forceUpdate()
    }

    const providerValue: DesignerContextData = {
        engine: engine,
        activeModel: activeModel,
        addDummyElements: addDummyElemets,
        setCurrentCanvas: c => {
            setCanvas(c ?? undefined)
            activeModel?.setForceRefresh(() => c?.forceUpdate())
        },
        introduceDevTool: d => {},// setDevTools(dts => [...dts, d]),
        addDevTool: addDevTool,
        setGlobalModelListeners: l => setListener(l),
        forceUpdate: () => canvas?.forceUpdate()
    }

    return <DesignerContext.Provider value={providerValue} children={children}/>
}