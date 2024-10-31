import { DataFormat, Fade, PortInput, Screen } from "@carbon/icons-react"
import { SideNav, SideNavItems, SideNavLink, SideNavMenu, SideNavMenuItem } from "@carbon/react"
import { useDesignerContext } from "../components/designer/designerContext"
import { DevToolSideNavMenuItem } from "./DevToolSideNavMenuItem"

export const MainSideMenu = (props: {}) => {
    return (
    <SideNav isFixedNav expanded={true} isChildOfHeader={false} aria-label="Side navigation">
      <SideNavItems>
        <SideNavMenu renderIcon={PortInput} title="Input">
          <DevToolSideNavMenuItem href="#" devTool="input:plainText">Plain Text</DevToolSideNavMenuItem>
          <DevToolSideNavMenuItem href="#" devTool="input:counter">Counter</DevToolSideNavMenuItem>
          <DevToolSideNavMenuItem href="#" devTool="input:debouncer">Debouncer</DevToolSideNavMenuItem>
        </SideNavMenu>
        <SideNavMenu renderIcon={DataFormat} title="Data Format">
          <DevToolSideNavMenuItem href="#" devTool="data:toBase64">
            To Base64
          </DevToolSideNavMenuItem>
          <DevToolSideNavMenuItem href="#" devTool="data:fromBase64">
            From Base64
          </DevToolSideNavMenuItem>
        </SideNavMenu>
        <SideNavMenu renderIcon={Screen} title="Display" isActive={true}>
         <DevToolSideNavMenuItem href="#" devTool="display:billboard">
            Billboard
          </DevToolSideNavMenuItem>
        </SideNavMenu>
      </SideNavItems>
    </SideNav>
    )
}