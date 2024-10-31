import { DefaultLinkFactory } from "@projectstorm/react-diagrams";
import { DevToolLinkModel } from "./DevToolLinkModel";

export class DevToolLinkFactory extends DefaultLinkFactory {
	constructor() {
		super('devtool');
	}

	generateModel(): DevToolLinkModel {
		return new DevToolLinkModel();
	}

}