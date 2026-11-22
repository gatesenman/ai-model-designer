import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { Button, Dropdown, Input, Space, Tooltip, message } from 'antd'
import type { MenuProps } from 'antd'
import {
  PlusOutlined,
  AppstoreOutlined,
  DeleteOutlined,
  SearchOutlined,
  CloseOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  ExpandOutlined
} from '@ant-design/icons'
import { useModelStore } from '../store/modelStore'
import { applyLayout, LAYOUT_LABELS, type LayoutType } from './layout'
import { RELATION_LABELS } from '@shared/types'
import type { DiagramEdge, DiagramNode, RelationKind } from '@shared/types'
import { getDiagramSchema, type NodeShape } from '@shared/diagramSchema'
import { buildNodeHtml } from './d3/nodeHtml'
import { rectEdgePath, type Box } from './d3/geometry'
import './d3/d3graph.css'

const KIND_EMPTY_HINTS: Record<string, { title: string; desc: string }> = {
  conceptual: { title: '概念建模', desc: '使用 AI 面板描述业务领域，或手动创建实体和关系来构建概念模型' },
  logical: { title: '逻辑建模', desc: '使用 AI 面板生成逻辑模型，或手动创建实体、定义属性与主外键关系' },
  physical: { title: '物理建模', desc: '使用 AI 面板生成数据库表结构，或手动创建表、定义列、索引与约束' },
  uml: { title: 'UML 类图设计', desc: '使用 AI 面板生成类图，或手动创建类、接口，定义属性与方法' },
  architecture: { title: '架构设计', desc: '使用 AI 面板生成架构图，或手动创建组件，定义依赖关系' }
}

/** 关系 → 线型（虚线） */
function edgeDash(relation: string): string | null {
  if (relation === 'dependency' || relation === 'implementation') return '6 4'
  if (relation === 'aggregation') return '8 3'
  return null
}

/** 关系 → 终点箭头 marker id */
function edgeMarker(relation: string, selected: boolean): string {
  const s = selected ? '-sel' : ''
  if (relation === 'inheritance') return `mk-triangle${s}`
  if (relation === 'composition') return `mk-diamond-filled${s}`
  if (relation === 'aggregation') return `mk-diamond${s}`
  return `mk-arrow${s}`
}

const DEFAULT_W = 200
const DEFAULT_H = 90

/**
 * 自研 D3 图引擎（替代 React Flow）：
 * - d3-zoom 缩放/平移，d3-drag 拖拽节点
 * - 从节点连接点拖拽建立连线
 * - 单选 / Shift 多选 / Shift 框选 / Ctrl+A 全选 / Delete 删除
 * - 节点按 schema 形状与调色板渲染，HTML 层 + SVG 边层共享缩放变换
 */
export default function D3GraphCanvas(): JSX.Element {
  const doc = useModelStore((s) => s.doc)
  const schema = useMemo(() => getDiagramSchema(doc.diagramType), [doc.diagramType])

  const addNode = useModelStore((s) => s.addNode)
  const setNodes = useModelStore((s) => s.setNodes)

  const [searchText, setSearchText] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  // 持久化的 d3 选择集与状态
  const svgRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null)
  const edgeLayerRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null)
  const overlayRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null)
  const nodeLayerRef = useRef<d3.Selection<HTMLDivElement, unknown, null, undefined> | null>(null)
  const zoomRef = useRef<d3.ZoomBehavior<HTMLDivElement, unknown> | null>(null)
  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity)
  const sizeRef = useRef<Map<string, { w: number; h: number }>>(new Map())
  const livePosRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const searchRef = useRef('')
  const connectFromRef = useRef<string | null>(null)

  searchRef.current = searchText

  /** 读取节点盒（世界坐标） */
  const nodeBox = useCallback((n: DiagramNode): Box => {
    const p = livePosRef.current.get(n.id) ?? n.position
    const sz = sizeRef.current.get(n.id) ?? { w: DEFAULT_W, h: DEFAULT_H }
    return { x: p.x, y: p.y, w: sz.w, h: sz.h }
  }, [])

  /** 重绘所有边 */
  const drawEdges = useCallback(() => {
    const layer = edgeLayerRef.current
    if (!layer) return
    const state = useModelStore.getState()
    const d = state.doc
    const selectedEdgeId = state.selectedEdgeId
    const isOntology = d.kind === 'conceptual'
    const byId = new Map(d.nodes.map((n) => [n.id, n]))

    const groups = layer
      .selectAll<SVGGElement, DiagramEdge>('g.d3-edge')
      .data(d.edges, (e) => e.id)
    groups.exit().remove()
    const enter = groups.enter().append('g').attr('class', 'd3-edge')
    enter.append('path').attr('class', 'd3-edge__hit')
    enter.append('path').attr('class', 'd3-edge__line')
    enter.append('text').attr('class', 'd3-edge__label')
    const merged = enter.merge(groups)

    merged.each(function (e) {
      const src = byId.get(e.source)
      const tgt = byId.get(e.target)
      const g = d3.select(this)
      if (!src || !tgt) {
        g.attr('display', 'none')
        return
      }
      g.attr('display', null)
      const selected = e.id === selectedEdgeId
      const path = rectEdgePath(nodeBox(src), nodeBox(tgt))
      const dash = edgeDash(e.relation)
      g.select<SVGPathElement>('path.d3-edge__hit')
        .attr('d', path.d)
        .on('click', (ev: MouseEvent) => {
          ev.stopPropagation()
          useModelStore.getState().selectEdge(e.id)
        })
        .on('dblclick', (ev: MouseEvent) => {
          ev.stopPropagation()
          const label = window.prompt('请输入关系标签', e.label ?? '')
          if (label !== null) useModelStore.getState().updateEdge(e.id, { label })
        })
      g.select<SVGPathElement>('path.d3-edge__line')
        .attr('d', path.d)
        .attr('stroke', selected ? '#ff7a00' : '#7a869a')
        .attr('stroke-width', selected ? 2.5 : 1.5)
        .attr('stroke-dasharray', dash)
        .attr('marker-end', `url(#${edgeMarker(e.relation, selected)})`)
      const baseLabel = e.label || RELATION_LABELS[e.relation]
      const label =
        isOntology && (e.sourceCardinality || e.targetCardinality)
          ? `${e.sourceCardinality ?? ''} ─ ${baseLabel} ─ ${e.targetCardinality ?? ''}`.trim()
          : baseLabel
      g.select<SVGTextElement>('text.d3-edge__label')
        .attr('x', path.mid.x)
        .attr('y', path.mid.y - 4)
        .attr('fill', selected ? '#ff7a00' : '#5a6577')
        .text(label)
    })
  }, [nodeBox])

  /** 应用缩放变换到两层 */
  const applyTransform = useCallback((t: d3.ZoomTransform) => {
    transformRef.current = t
    edgeLayerRef.current?.attr('transform', t.toString())
    overlayRef.current?.attr('transform', t.toString())
    nodeLayerRef.current?.style(
      'transform',
      `translate(${t.x}px, ${t.y}px) scale(${t.k})`
    )
  }, [])

  /** 全量渲染节点 + 边 */
  const render = useCallback(() => {
    const layer = nodeLayerRef.current
    if (!layer) return
    const state = useModelStore.getState()
    const d = state.doc
    const sch = getDiagramSchema(d.diagramType)
    const selectedIds = state.selectedNodeIds
    const primaryId = state.selectedNodeId
    const search = searchRef.current.trim().toLowerCase()
    const matched = new Set<string>()
    if (search) {
      for (const n of d.nodes) {
        if (
          n.label.toLowerCase().includes(search) ||
          n.fields.some((f) => f.name.toLowerCase().includes(search))
        )
          matched.add(n.id)
      }
    }

    const resolveShape = (n: DiagramNode): { shape?: NodeShape; color?: string } => {
      const k =
        sch.nodeKinds.find((x) => x.id === n.nodeKind) ??
        (n.category ? sch.nodeKinds.find((x) => x.category === n.category) : undefined)
      return { shape: k?.shape, color: k?.color }
    }

    // 同步 livePos（未拖拽时以 store 为准）
    for (const n of d.nodes) livePosRef.current.set(n.id, { ...n.position })
    for (const id of Array.from(livePosRef.current.keys())) {
      if (!d.nodes.some((n) => n.id === id)) livePosRef.current.delete(id)
    }

    const sel = layer
      .selectAll<HTMLDivElement, DiagramNode>('div.d3-node')
      .data(d.nodes, (n) => n.id)
    sel.exit<DiagramNode>().each((n) => sizeRef.current.delete(n.id)).remove()
    const enter = sel
      .enter()
      .append('div')
      .attr('class', 'd3-node')
      .on('mousedown', function (ev: MouseEvent, n) {
        ev.stopPropagation()
        const st = useModelStore.getState()
        if (ev.shiftKey) st.toggleSelectNode(n.id)
        else if (!st.selectedNodeIds.includes(n.id)) st.selectNode(n.id)
      })
      .on('dblclick', function (ev: MouseEvent, n) {
        ev.stopPropagation()
        const label = window.prompt('重命名', n.label)
        if (label) useModelStore.getState().updateNode(n.id, { label })
      })
    enter.append('div').attr('class', 'd3-node__body')
    enter.append('div').attr('class', 'd3-handle d3-handle--r').attr('title', '拖拽连线')

    const merged = enter.merge(sel)
    merged
      .style('left', (n) => `${(livePosRef.current.get(n.id) ?? n.position).x}px`)
      .style('top', (n) => `${(livePosRef.current.get(n.id) ?? n.position).y}px`)
      .classed('is-selected', (n) => selectedIds.includes(n.id))
      .classed('is-multi', (n) => selectedIds.length > 1 && selectedIds.includes(n.id))
      .classed('is-primary', (n) => selectedIds.length > 1 && n.id === primaryId)
      .classed('is-dim', (n) => matched.size > 0 && !matched.has(n.id))
      .classed('is-hit', (n) => matched.has(n.id))
      .classed('d3-node--container', (n) => n.category === 'boundary' || n.category === 'grouping')
    merged.select('div.d3-node__body').html((n) => {
      const { shape, color } = resolveShape(n)
      return buildNodeHtml(n, d.kind, shape, color)
    })

    // drag：拖拽节点（含多选整体移动）
    const drag = d3
      .drag<HTMLDivElement, DiagramNode>()
      .filter((ev: MouseEvent) => !(ev.target as HTMLElement).classList.contains('d3-handle'))
      .on('start', (ev, n) => {
        const st = useModelStore.getState()
        if (!ev.sourceEvent.shiftKey && !st.selectedNodeIds.includes(n.id)) st.selectNode(n.id)
      })
      .on('drag', (ev, n) => {
        const k = transformRef.current.k
        const st = useModelStore.getState()
        const ids =
          st.selectedNodeIds.length > 1 && st.selectedNodeIds.includes(n.id)
            ? st.selectedNodeIds
            : [n.id]
        for (const id of ids) {
          const cur = livePosRef.current.get(id) ?? { x: 0, y: 0 }
          const np = { x: cur.x + ev.dx / k, y: cur.y + ev.dy / k }
          livePosRef.current.set(id, np)
          layer
            .selectAll<HTMLDivElement, DiagramNode>('div.d3-node')
            .filter((d2) => d2.id === id)
            .style('left', `${np.x}px`)
            .style('top', `${np.y}px`)
        }
        drawEdges()
      })
      .on('end', (_ev, n) => {
        const st = useModelStore.getState()
        const ids =
          st.selectedNodeIds.length > 1 && st.selectedNodeIds.includes(n.id)
            ? st.selectedNodeIds
            : [n.id]
        for (const id of ids) {
          const p = livePosRef.current.get(id)
          if (p) st.moveNode(id, p.x, p.y)
        }
      })
    merged.call(drag)

    // 连接点拖拽建立连线
    const connectDrag = d3
      .drag<HTMLDivElement, DiagramNode>()
      .container(() => containerRef.current as HTMLDivElement)
      .on('start', (ev, n) => {
        connectFromRef.current = n.id
        overlayRef.current
          ?.append('path')
          .attr('class', 'd3-connect-temp')
          .attr('d', '')
        ev.sourceEvent.stopPropagation()
      })
      .on('drag', (ev, n) => {
        const src = useModelStore.getState().doc.nodes.find((x) => x.id === n.id)
        if (!src) return
        const t = transformRef.current
        const wx = (ev.x - t.x) / t.k
        const wy = (ev.y - t.y) / t.k
        const b = nodeBox(src)
        overlayRef.current
          ?.select('path.d3-connect-temp')
          .attr('d', `M ${b.x + b.w / 2},${b.y + b.h / 2} L ${wx},${wy}`)
      })
      .on('end', (ev) => {
        overlayRef.current?.select('path.d3-connect-temp').remove()
        const from = connectFromRef.current
        connectFromRef.current = null
        if (!from) return
        const se = ev.sourceEvent as MouseEvent
        const el = document.elementFromPoint(se.clientX, se.clientY) as HTMLElement | null
        const nodeEl = el?.closest('.d3-node') as HTMLElement | null
        if (!nodeEl) return
        const targetDatum = d3.select<HTMLElement, DiagramNode>(nodeEl).datum()
        if (targetDatum && targetDatum.id !== from) {
          const st = useModelStore.getState()
          const k = st.doc.kind
          const defaultRel: RelationKind =
            k === 'physical'
              ? 'fk'
              : k === 'architecture'
                ? 'dependency'
                : k === 'uml'
                  ? 'association'
                  : 'oneToMany'
          st.addEdge(from, targetDatum.id, defaultRel)
        }
      })
    merged.select<HTMLDivElement>('div.d3-handle--r').call(
      connectDrag as unknown as (
        s: d3.Selection<HTMLDivElement, DiagramNode, HTMLDivElement, unknown>
      ) => void
    )

    // 测量节点尺寸（世界坐标）后重绘边
    merged.each(function (n) {
      const r = (this as HTMLDivElement).getBoundingClientRect()
      const k = transformRef.current.k || 1
      sizeRef.current.set(n.id, { w: r.width / k, h: r.height / k })
    })
    drawEdges()
  }, [drawEdges, nodeBox])

  /** 适应视图 */
  const fitView = useCallback(() => {
    const container = containerRef.current
    const zoom = zoomRef.current
    if (!container || !zoom) return
    const d = useModelStore.getState().doc
    if (d.nodes.length === 0) {
      d3.select(container).transition().duration(300).call(zoom.transform, d3.zoomIdentity)
      return
    }
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const n of d.nodes) {
      const b = nodeBox(n)
      minX = Math.min(minX, b.x)
      minY = Math.min(minY, b.y)
      maxX = Math.max(maxX, b.x + b.w)
      maxY = Math.max(maxY, b.y + b.h)
    }
    const pad = 60
    const w = maxX - minX + pad * 2
    const h = maxY - minY + pad * 2
    const cw = container.clientWidth
    const ch = container.clientHeight
    const k = Math.min(1.1, Math.min(cw / w, ch / h))
    const tx = (cw - k * (minX + maxX)) / 2
    const ty = (ch - k * (minY + maxY)) / 2
    d3.select(container)
      .transition()
      .duration(300)
      .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(k))
  }, [nodeBox])

  // 一次性初始化 D3 场景
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const root = d3.select(container)
    const svg = root.append('svg').attr('class', 'd3-graph__svg')
    svgRef.current = svg

    // markers
    const defs = svg.append('defs')
    const mk = (id: string, color: string, filled: boolean, shape: 'arrow' | 'triangle' | 'diamond'): void => {
      const m = defs
        .append('marker')
        .attr('id', id)
        .attr('viewBox', '0 0 12 12')
        .attr('refX', 11)
        .attr('refY', 6)
        .attr('markerWidth', 11)
        .attr('markerHeight', 11)
        .attr('orient', 'auto-start-reverse')
      if (shape === 'arrow') {
        m.append('path').attr('d', 'M1,1 L11,6 L1,11').attr('fill', 'none').attr('stroke', color).attr('stroke-width', 1.6)
      } else if (shape === 'triangle') {
        m.append('path').attr('d', 'M1,1 L11,6 L1,11 Z').attr('fill', '#fff').attr('stroke', color).attr('stroke-width', 1.4)
      } else {
        m.append('path').attr('d', 'M1,6 L6,1 L11,6 L6,11 Z').attr('fill', filled ? color : '#fff').attr('stroke', color).attr('stroke-width', 1.2)
      }
    }
    ;(['#7a869a', '#ff7a00'] as const).forEach((c, i) => {
      const s = i === 1 ? '-sel' : ''
      mk(`mk-arrow${s}`, c, false, 'arrow')
      mk(`mk-triangle${s}`, c, false, 'triangle')
      mk(`mk-diamond${s}`, c, false, 'diamond')
      mk(`mk-diamond-filled${s}`, c, true, 'diamond')
    })

    edgeLayerRef.current = svg.append('g').attr('class', 'd3-graph__edges')
    overlayRef.current = svg.append('g').attr('class', 'd3-graph__overlay')
    const nodeLayer = root.append('div').attr('class', 'd3-graph__nodes')
    nodeLayerRef.current = nodeLayer as unknown as d3.Selection<HTMLDivElement, unknown, null, undefined>

    const zoom = d3
      .zoom<HTMLDivElement, unknown>()
      .scaleExtent([0.2, 2])
      .filter((ev: MouseEvent) => {
        // 滚轮缩放；空白拖拽平移；Shift+拖拽 走框选
        if (ev.type === 'wheel') return true
        if (ev.type === 'mousedown') return !ev.shiftKey && (ev.target as HTMLElement) === container
        return true
      })
      .on('zoom', (ev) => applyTransform(ev.transform))
    zoomRef.current = zoom
    root.call(zoom)
    root.on('dblclick.zoom', null)

    // 点击空白清除选择
    root.on('click', (ev: MouseEvent) => {
      if ((ev.target as HTMLElement) === container || (ev.target as HTMLElement).tagName === 'svg') {
        useModelStore.getState().clearSelection()
      }
    })

    // Shift+拖拽 框选
    let rubber: { x0: number; y0: number } | null = null
    root.on('mousedown', (ev: MouseEvent) => {
      if (!ev.shiftKey || (ev.target as HTMLElement).closest('.d3-node')) return
      const rect = container.getBoundingClientRect()
      rubber = { x0: ev.clientX - rect.left, y0: ev.clientY - rect.top }
      overlayRef.current
        ?.append('rect')
        .attr('class', 'd3-rubber')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 0)
        .attr('height', 0)
    })
    root.on('mousemove', (ev: MouseEvent) => {
      if (!rubber) return
      const rect = container.getBoundingClientRect()
      const x1 = ev.clientX - rect.left
      const y1 = ev.clientY - rect.top
      const t = transformRef.current
      const wx0 = (Math.min(rubber.x0, x1) - t.x) / t.k
      const wy0 = (Math.min(rubber.y0, y1) - t.y) / t.k
      const ww = Math.abs(x1 - rubber.x0) / t.k
      const wh = Math.abs(y1 - rubber.y0) / t.k
      overlayRef.current
        ?.select('rect.d3-rubber')
        .attr('x', wx0)
        .attr('y', wy0)
        .attr('width', ww)
        .attr('height', wh)
    })
    root.on('mouseup', () => {
      if (!rubber) return
      const rectSel = overlayRef.current?.select<SVGRectElement>('rect.d3-rubber')
      if (rectSel && !rectSel.empty()) {
        const rx = +rectSel.attr('x')
        const ry = +rectSel.attr('y')
        const rw = +rectSel.attr('width')
        const rh = +rectSel.attr('height')
        const st = useModelStore.getState()
        const hit = st.doc.nodes
          .filter((n) => {
            const b = nodeBox(n)
            return b.x < rx + rw && b.x + b.w > rx && b.y < ry + rh && b.y + b.h > ry
          })
          .map((n) => n.id)
        if (hit.length > 0) st.setSelectedNodes(hit)
        rectSel.remove()
      }
      rubber = null
    })

    render()
    setTimeout(fitView, 60)

    return () => {
      root.selectAll('*').remove()
      root.on('.zoom', null)
      root.on('click mousedown mousemove mouseup', null)
    }
  }, [])

  // 订阅 store 变化重绘
  useEffect(() => {
    render()
    const unsub = useModelStore.subscribe(() => render())
    return unsub
  }, [render])

  // 搜索变化重绘
  useEffect(() => {
    render()
  }, [searchText, render])

  // 文档切换/节点增减时自动适应视图
  const prevDocId = useRef(doc.id)
  const prevCount = useRef(doc.nodes.length)
  useEffect(() => {
    if (prevDocId.current !== doc.id || (doc.nodes.length > 0 && prevCount.current !== doc.nodes.length)) {
      setTimeout(fitView, 80)
    }
    prevDocId.current = doc.id
    prevCount.current = doc.nodes.length
  }, [doc.id, doc.nodes.length, fitView])

  const handleDelete = useCallback(() => {
    const st = useModelStore.getState()
    if (st.selectedNodeIds.length > 1) {
      st.removeSelectedNodes()
      message.success(`已删除 ${st.selectedNodeIds.length} 个节点`)
    } else if (st.selectedNodeId) {
      st.removeNode(st.selectedNodeId)
      message.success('已删除节点')
    } else if (st.selectedEdgeId) {
      st.removeEdge(st.selectedEdgeId)
      message.success('已删除关系')
    } else {
      message.info('请先选择要删除的节点或关系')
    }
  }, [])

  // 键盘快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        handleDelete()
      }
      if (e.key === 'Escape') {
        useModelStore.getState().clearSelection()
        setShowSearch(false)
        setSearchText('')
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        useModelStore.getState().selectAllNodes()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setShowSearch(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleDelete])

  const handleLayout = useCallback(
    (type: LayoutType) => {
      setNodes(applyLayout(useModelStore.getState().doc, type))
      setTimeout(fitView, 60)
      message.success(`已应用${LAYOUT_LABELS[type]}`)
    },
    [setNodes, fitView]
  )

  const layoutMenuItems: MenuProps['items'] = (
    Object.entries(LAYOUT_LABELS) as [LayoutType, string][]
  ).map(([key, label]) => ({ key, label, onClick: () => handleLayout(key) }))

  const zoomBy = useCallback((factor: number) => {
    const container = containerRef.current
    const zoom = zoomRef.current
    if (container && zoom) d3.select(container).transition().duration(150).call(zoom.scaleBy, factor)
  }, [])

  const matchedCount = useMemo(() => {
    const s = searchText.trim().toLowerCase()
    if (!s) return 0
    return doc.nodes.filter(
      (n) => n.label.toLowerCase().includes(s) || n.fields.some((f) => f.name.toLowerCase().includes(s))
    ).length
  }, [searchText, doc.nodes])

  return (
    <div className="center-canvas">
      <div className="d3-graph" ref={containerRef} />

      <div className="d3-graph__toolbar">
        <Space.Compact className="canvas-toolbar">
          {schema.nodeKinds.length > 1 ? (
            <Dropdown
              menu={{
                items: schema.nodeKinds.map((k) => ({
                  key: k.id,
                  label: `新增${k.label}`,
                  onClick: () => addNode({ nodeKind: k.id })
                }))
              }}
              trigger={['click']}
            >
              <Tooltip title="新增节点（按类型）">
                <Button size="small" icon={<PlusOutlined />} />
              </Tooltip>
            </Dropdown>
          ) : (
            <Tooltip title={`新增${schema.nodeKinds[0]?.label ?? '节点'}`}>
              <Button size="small" icon={<PlusOutlined />} onClick={() => addNode({ nodeKind: schema.nodeKinds[0]?.id })} />
            </Tooltip>
          )}
          <Dropdown menu={{ items: layoutMenuItems }} trigger={['click']}>
            <Tooltip title="布局方式">
              <Button size="small" icon={<AppstoreOutlined />} />
            </Tooltip>
          </Dropdown>
          <Tooltip title="搜索节点 (Ctrl+F)">
            <Button
              size="small"
              icon={<SearchOutlined />}
              type={showSearch ? 'primary' : 'default'}
              onClick={() => {
                setShowSearch(!showSearch)
                if (showSearch) setSearchText('')
              }}
            />
          </Tooltip>
          <Tooltip title="删除选中 (Delete)">
            <Button size="small" danger icon={<DeleteOutlined />} onClick={handleDelete} />
          </Tooltip>
        </Space.Compact>
        {showSearch && (
          <div className="canvas-search-bar">
            <Input
              className="canvas-search-input"
              size="small"
              autoFocus
              placeholder="搜索节点或字段名..."
              prefix={<SearchOutlined />}
              suffix={
                searchText ? (
                  <CloseOutlined style={{ cursor: 'pointer', fontSize: 11 }} onClick={() => setSearchText('')} />
                ) : null
              }
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            {searchText && (
              <div className="canvas-search-count">
                匹配 {matchedCount} / {doc.nodes.length} 节点
              </div>
            )}
          </div>
        )}
      </div>

      <div className="d3-graph__controls">
        <Tooltip title="放大" placement="right">
          <Button size="small" icon={<ZoomInOutlined />} onClick={() => zoomBy(1.2)} />
        </Tooltip>
        <Tooltip title="缩小" placement="right">
          <Button size="small" icon={<ZoomOutOutlined />} onClick={() => zoomBy(1 / 1.2)} />
        </Tooltip>
        <Tooltip title="适应视图" placement="right">
          <Button size="small" icon={<ExpandOutlined />} onClick={fitView} />
        </Tooltip>
      </div>

      {doc.nodes.length === 0 && (
        <div className="empty-canvas-hint">
          <div className="empty-icon">
            <AppstoreOutlined />
          </div>
          <div className="empty-title">{KIND_EMPTY_HINTS[doc.kind]?.title ?? '开始设计'}</div>
          <div className="empty-desc">
            {KIND_EMPTY_HINTS[doc.kind]?.desc ?? '使用左侧 AI 面板生成模型，或点击工具栏 + 手动创建节点'}
          </div>
          <div className="empty-shortcuts">Delete 删除 · Ctrl+A 全选 · Ctrl+F 搜索 · Shift+拖拽 框选</div>
        </div>
      )}
    </div>
  )
}
