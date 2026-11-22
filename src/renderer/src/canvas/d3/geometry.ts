export interface Box {
  x: number
  y: number
  w: number
  h: number
}

interface Point {
  x: number
  y: number
}

/** 求线段（从矩形中心指向外部点）与矩形边界的交点 */
function borderPoint(box: Box, toward: Point): Point {
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  const dx = toward.x - cx
  const dy = toward.y - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  const hw = box.w / 2
  const hh = box.h / 2
  const scale = 1 / Math.max(Math.abs(dx) / hw, Math.abs(dy) / hh)
  return { x: cx + dx * scale, y: cy + dy * scale }
}

/**
 * 生成两个节点盒之间的连线路径（从各自边界出发，带轻微曲率），
 * 并返回中点用于放置标签。
 */
export function rectEdgePath(src: Box, tgt: Box): { d: string; mid: Point } {
  const sc = { x: src.x + src.w / 2, y: src.y + src.h / 2 }
  const tc = { x: tgt.x + tgt.w / 2, y: tgt.y + tgt.h / 2 }
  const p1 = borderPoint(src, tc)
  const p2 = borderPoint(tgt, sc)
  const mx = (p1.x + p2.x) / 2
  const my = (p1.y + p2.y) / 2
  // 贝塞尔控制点：水平主导用水平切线，垂直主导用垂直切线，观感更顺
  const horiz = Math.abs(p2.x - p1.x) >= Math.abs(p2.y - p1.y)
  const c1 = horiz ? { x: mx, y: p1.y } : { x: p1.x, y: my }
  const c2 = horiz ? { x: mx, y: p2.y } : { x: p2.x, y: my }
  const d = `M ${p1.x},${p1.y} C ${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`
  return { d, mid: { x: mx, y: my } }
}
