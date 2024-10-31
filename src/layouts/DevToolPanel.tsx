import { Heading, Section, TextInput } from "@carbon/react"
import { BaseModel, BaseModelGenerics } from "@projectstorm/react-diagrams"
import "./DevToolPanel.css"
import { DevTool } from "../components/devtools/DevTool"
import { useEffect, useState } from "react"
import { DevToolPortModel } from "../components/devtools/DevToolPortModel"

export type DevToolPanelProps = {
    entity: BaseModel<BaseModelGenerics>,
    onUpdateRequest?: () => void | undefined
}
export const DevToolPanel = ({ entity, onUpdateRequest }: DevToolPanelProps) => {
    const devTool = entity as DevTool;
    const [toolName, setToolName] = useState(devTool.getOptions().name)
    
    useEffect(() => {
        setToolName(devTool.getOptions().name)
    }, [devTool, devTool.getOptions().name])

    const onToolNameChanged = (newVal: string) => {
        devTool.getOptions().name = newVal
        setToolName(newVal)
        if(onUpdateRequest) {
            onUpdateRequest()
        }
    }
    return (
    <div className='panel-content' onKeyDown={e => e.stopPropagation()}>
        <Section level={4}>
            {devTool.getToolOptions().canRename ?
                <TextInput className="panel-header-text" type="text" value={toolName}
                    onChange={e => onToolNameChanged(e.target.value)} id="tool-name"
                    labelText={undefined} /> :
                <Heading className="panel-header-text">{devTool.getToolOptions().panelDisplayName ?? toolName}</Heading>
            }
        </Section>
     

          { devTool.renderConfiguration() }
          {JSON.stringify(devTool.getOptions().extras)} <br></br>
          {JSON.stringify(Object.values(devTool.getPorts()).map(x => (x as DevToolPortModel).getInPortValue()))}<br></br>
          { JSON.stringify(devTool.calculateOutputs())}
    </div>
    )
}