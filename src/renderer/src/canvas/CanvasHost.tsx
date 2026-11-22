import { useMemo } from 'react'
import { useModelStore } from '../store/modelStore'
import { getRenderKind } from '@shared/diagramRender'
import D3GraphCanvas from './D3GraphCanvas'
import SequenceCanvas from './renderers/SequenceCanvas'
import SwimlaneCanvas from './renderers/SwimlaneCanvas'
import MatrixCanvas from './renderers/MatrixCanvas'
import TreeCanvas from './renderers/TreeCanvas'
import TimelineCanvas from './renderers/TimelineCanvas'

/**
 * 画布调度层：按图种的渲染范式（renderKind）分发到对应的"真实图形"渲染器。
 * graph 范式使用 D3 节点-边画布，其余范式各有独立交互式渲染器。
 */
export default function CanvasHost() {
  const diagramType = useModelStore((s) => s.doc.diagramType)
  const renderKind = useMemo(() => getRenderKind(diagramType), [diagramType])

  switch (renderKind) {
    case 'sequence':
      return <SequenceCanvas />
    case 'swimlane':
      return <SwimlaneCanvas />
    case 'matrix':
      return <MatrixCanvas />
    case 'tree':
      return <TreeCanvas />
    case 'timeline':
      return <TimelineCanvas />
    default:
      return <D3GraphCanvas />
  }
}
