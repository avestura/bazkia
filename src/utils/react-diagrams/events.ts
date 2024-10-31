import { BaseEntityEvent, BaseEvent, BaseModel, DefaultLinkModel, DefaultPortModel } from "@projectstorm/react-diagrams";
import { DevTool } from "../../components/devtools/DevTool";

export function isSelectionEvent(ev: BaseEvent & {function: string}): ev is BaseEntityEvent<BaseModel> & { isSelected: boolean; function: string } {
    return ev.function === "selectionChanged"
}

export function isOffsetUpdatedEvent(ev: BaseEvent & {function: string}): ev is BaseEntityEvent<BaseModel> & { offsetX: number, offsetY: number, function: string } {
    return ev.function === "offsetUpdated"
}

export function isZoomUpdatedEvent(ev: BaseEvent & {function: string}): ev is BaseEntityEvent<BaseModel> & { zoom: number, function: string } {
    return ev.function === "zoomUpdated"
}

export type LinkUpdatedEvent = BaseEntityEvent<BaseModel> &
{
    isCreated: boolean,
    link: DefaultLinkModel,
    function: string,
    stopPropagation: () => void
}
export function isLinksUpdatedEvent(ev: BaseEvent & {function: string}): ev is LinkUpdatedEvent {
    return ev.function === "linksUpdated"
}

export type PortChangedEvent = {
    firing: boolean,
    entity: DevTool,
    port: DefaultPortModel,
    stopPropagation: () => void
}
