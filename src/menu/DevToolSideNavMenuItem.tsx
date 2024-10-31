import { SideNav, SideNavItems, SideNavLink, SideNavMenu, SideNavMenuItem } from "@carbon/react"
import { DevToolId } from "../components/devtools/devtools"

export type DevToolSideNavMenuItemProps = {
    devTool: DevToolId
} 

export const DevToolSideNavMenuItem = (props: React.ComponentProps<typeof SideNavMenuItem> & DevToolSideNavMenuItemProps) => {
    const { devTool, ...sideMenuProps } = props
    return <SideNavMenuItem {...sideMenuProps} draggable={true}
        onDragStart={(ev) => {
            ev.dataTransfer.dropEffect = 'move'
            ev.dataTransfer.setData('text', devTool)
        }}/>
}