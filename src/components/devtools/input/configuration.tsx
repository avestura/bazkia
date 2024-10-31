import { TextArea } from "@carbon/react"
import { PlainTextInputDevTool } from "./plain"
import { useParameters } from "../hooks"

export type PlainTextConfigurationProps = {
    devTool: PlainTextInputDevTool
}
export const PlainTextConfiguration = ({ devTool }: PlainTextConfigurationProps) => {
    const [getParamaeter, setParamater, _] = useParameters(devTool)
    return <TextArea 
        labelText="String Input"
        helperText=""
        rows={4} 
        defaultValue={getParamaeter("text")}
        onChange={(e) => setParamater("text", e.target.value)}/>
}