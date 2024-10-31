import {
  Header,
  HeaderName,
  SkipToContent,
  HeaderPanel,
  Content,
  Heading,
} from '@carbon/react';
import { BaseEntityEvent, BaseModel, BaseModelListener, CanvasWidget } from '@projectstorm/react-diagrams';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDesignerContext } from '../components/designer/designerContext';
import "./MainLayout.css"
import { MainSideMenu } from '../menu/MainSideMenu';
import { isLinksUpdatedEvent, isOffsetUpdatedEvent, isZoomUpdatedEvent, PortChangedEvent } from '../utils/react-diagrams/events';
import { DevToolId } from '../components/devtools/devtools';
import { DevToolPanel } from './DevToolPanel';
import { DevTool } from '../components/devtools/DevTool';
import { DevToolLinkModel } from '../components/devtools/DevToolLinkModel';


export const MainLayout = (props: {}) => {
  const canvas = useRef<CanvasWidget>(null)
  const [showPanel, setShowPanel] = useState(false)
  const [selectedEntity, setSelectedEntity] = useState<BaseEntityEvent<BaseModel>["entity"] | undefined>(undefined)
  const designer = useDesignerContext()
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [zoomRatio, setZoomRatio] = useState(100)

  const zoomBigNumber = useMemo(() => 95 * (zoomRatio/100), [zoomRatio])
  const zoomSmallNumber = useMemo(() => 19 * (zoomRatio/100), [zoomRatio])
  
  useEffect(() => {
    designer.setCurrentCanvas(canvas.current)
  }, [])

  const selectionChangedHandler: BaseModelListener["selectionChanged"] = (ev) => {
    if(ev.isSelected) {
      setSelectedEntity(ev.entity)
      setShowPanel(true)
    } else {
      setShowPanel(false)
      setSelectedEntity(undefined)
    }
  }

  const removeHandler: BaseModelListener["entityRemoved"] = (ev) => {
    setShowPanel(false)
    setSelectedEntity(undefined)
  }

  useEffect(() => {
    //@ts-expect-error
    designer.setGlobalModelListeners({
      entityRemoved: removeHandler,
      selectionChanged: selectionChangedHandler,
    })
    //@ts-expect-error
    designer.activeModel.registerListener({
      eventDidFire: ev => {
        if(isZoomUpdatedEvent(ev)) {
          setZoomRatio(ev.zoom)
        }
        if(isOffsetUpdatedEvent(ev)) {
          setOffsetX(ev.offsetX)
          setOffsetY(ev.offsetY)
        }
      },

    })
    return () => {
      designer.activeModel.clearListeners()
    }
  }, [])
  
  return <>
    <style>
      {
      `
      .main-canvas {
          background-position-x: ${offsetX}px;
          background-position-y: ${offsetY}px;
          background-size: ${zoomBigNumber}px ${zoomBigNumber}px, ${zoomBigNumber}px ${zoomBigNumber}px,
                           ${zoomSmallNumber}px ${zoomSmallNumber}px, ${zoomSmallNumber}px ${zoomSmallNumber}px
      }
      `
      }
    </style>
    <Header aria-label="Bazkia">
      <SkipToContent />
      <HeaderName prefix="Avestura">
        Bazkia
      </HeaderName>
      { showPanel && selectedEntity &&
        <HeaderPanel expanded className='main-header-panel'>
          <DevToolPanel entity={selectedEntity}
            onUpdateRequest={() => designer?.forceUpdate()}
            />
        </HeaderPanel>
      }
    </Header>
    <MainSideMenu />
    <Content className='main-content' onDrop={ev => {
      const devToolId = ev.dataTransfer.getData('text')     
        designer.addDevTool(devToolId as DevToolId, ev)
      }} onDragOver={ev => ev.preventDefault()} >
      <CanvasWidget ref={canvas} className='main-canvas' engine={designer.engine} />
    </Content>
  </>
}