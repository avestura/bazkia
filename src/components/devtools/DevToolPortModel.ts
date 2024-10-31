import { DefaultPortModel, DefaultPortModelOptions, PortModelAlignment } from "@projectstorm/react-diagrams";
import { DevToolLinkModel } from "./DevToolLinkModel";

export class DevToolPortModel extends DefaultPortModel {
    constructor(options: DefaultPortModelOptions) {
        options = options;
        super(Object.assign({ label: options.label || options.name, alignment: options.in ? PortModelAlignment.LEFT : PortModelAlignment.RIGHT, type: 'default' }, options));
		this.options.extras = {
			value: undefined
		}
    }

    setInPortValue(value: any) {
		const options = this.options
		if(options.in) {
			options.extras.value = value
		}
    }

    getInPortValue() {
        const options = this.options;
        if(options.in) {
            return options.extras.value 
		}
    }

	createLinkModel(): DevToolLinkModel {
		return new DevToolLinkModel();
	}
}