import type { DiagramNode, ModelKind } from '@shared/types'
import type { NodeShape } from '@shared/diagramSchema'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function visSymbol(v?: string): string {
  if (v === 'private') return '-'
  if (v === 'protected') return '#'
  return '+'
}

const STRIDE_ORDER = ['S', 'T', 'R', 'I', 'D', 'E'] as const
const STRIDE_NAME: Record<string, string> = {
  S: 'Spoofing 仿冒',
  T: 'Tampering 篡改',
  R: 'Repudiation 抵赖',
  I: 'Information Disclosure 信息泄露',
  D: 'Denial of Service 拒绝服务',
  E: 'Elevation of Privilege 权限提升'
}

function strideLetters(node: DiagramNode): string[] {
  const raw = node.props?.stride
  if (Array.isArray(raw)) return raw.map((x) => String(x).toUpperCase())
  if (typeof raw === 'string') return raw.split(/[,\s]+/).map((x) => x.toUpperCase()).filter(Boolean)
  return []
}

function isThreatNode(node: DiagramNode): boolean {
  return node.nodeKind === 'threat' || node.category === 'threat'
}

function strideBadgesHtml(node: DiagramNode): string {
  const active = new Set(strideLetters(node))
  const chips = STRIDE_ORDER.map(
    (l) =>
      `<span class="stride-chip ${active.has(l) ? 'is-on' : ''}" title="${esc(STRIDE_NAME[l])}">${l}</span>`
  ).join('')
  return `<div class="stride-row">${chips}</div>`
}

// 线框图真实 UI 控件
const WF_KINDS = new Set([
  'button',
  'input',
  'text',
  'image',
  'checkbox',
  'dropdown',
  'list',
  'avatar',
  'screen',
  'section'
])

function isWireframeNode(node: DiagramNode): boolean {
  return (node.category ?? '').startsWith('ui-') || (node.nodeKind != null && WF_KINDS.has(node.nodeKind))
}

function wireframeHtml(node: DiagramNode): string {
  const label = esc(node.label)
  switch (node.nodeKind) {
    case 'button':
      return `<div class="wf wf-frame wf-frame--bare"><button class="wf-btn">${label}</button></div>`
    case 'input':
      return `<div class="wf wf-frame"><div class="wf-input"><span>${label || '输入…'}</span></div></div>`
    case 'text':
      return `<div class="wf wf-frame"><div class="wf-text"><b>${label}</b><i></i><i></i></div></div>`
    case 'image':
      return `<div class="wf wf-frame"><div class="wf-image"><svg viewBox="0 0 40 28"><rect x="1" y="1" width="38" height="26" fill="none" stroke="currentColor"/><path d="M1 1 L39 27 M39 1 L1 27" stroke="currentColor"/></svg><span>${label}</span></div></div>`
    case 'checkbox':
      return `<div class="wf wf-frame wf-frame--bare"><label class="wf-check"><span class="wf-box">✓</span>${label}</label></div>`
    case 'dropdown':
      return `<div class="wf wf-frame"><div class="wf-dropdown"><span>${label || '请选择'}</span><b>▾</b></div></div>`
    case 'list':
      return `<div class="wf wf-frame"><div class="wf-listhead">${label}</div><div class="wf-list"><i></i><i></i><i></i></div></div>`
    case 'avatar':
      return `<div class="wf wf-frame wf-frame--bare"><div class="wf-avatar"></div></div>`
    case 'screen':
      return `<div class="wf wf-screen"><div class="wf-screen__bar"><span></span><span></span><span></span><em>${label}</em></div><div class="wf-screen__body"></div></div>`
    case 'section':
      return `<div class="wf wf-section"><span class="wf-section__label">${label}</span></div>`
    default:
      return `<div class="wf wf-frame"><span>${label}</span></div>`
  }
}

function isContainerNode(node: DiagramNode): boolean {
  return node.category === 'boundary' || node.category === 'grouping'
}

function containerHtml(node: DiagramNode): string {
  const style = node.props?.color ? ` style="border-color:${esc(String(node.props.color))}"` : ''
  return (
    `<div class="d3-container"${style}>` +
    `<span class="d3-container__label">${esc(node.label)}</span>` +
    `</div>`
  )
}

function stereotypeText(node: DiagramNode): string | null {
  if (!node.stereotype) return null
  const map: Record<string, string> = {
    interface: 'interface',
    abstract: 'abstract',
    enum: 'enumeration',
    object: 'Object Type',
    link: 'Link Type',
    action: 'Action Type',
    value: 'Value Type'
  }
  return map[node.stereotype] ?? null
}

/**
 * 生成节点内容 HTML（供 D3 渲染，复用 EntityNode 的样式类）。
 * 非卡片形状走 flow-node（居中标签 + 形状外框）。
 */
export function buildNodeHtml(
  node: DiagramNode,
  kind: ModelKind,
  shape: NodeShape | undefined,
  shapeColor: string | undefined
): string {
  const isUml = kind === 'uml'
  const isArch = kind === 'architecture'
  const isOntology = kind === 'conceptual'
  const stereo = stereotypeText(node)

  // 嵌套容器（C4 系统/信任边界、ArchiMate 分组）
  if (isContainerNode(node)) return containerHtml(node)

  // 线框图真实 UI 控件
  if (isWireframeNode(node)) return wireframeHtml(node)

  if (shape && shape !== 'card') {
    const style = shapeColor ? ` style="border-color:${esc(shapeColor)}"` : ''
    return (
      `<div class="flow-node shape-${shape}"${style}>` +
      `<div class="flow-node__inner">` +
      (stereo ? `<span class="flow-node__stereo">«${esc(stereo)}»</span>` : '') +
      `<span class="flow-node__label">${esc(node.label)}</span>` +
      (isThreatNode(node) ? strideBadgesHtml(node) : '') +
      (node.comment ? `<span class="flow-node__comment">${esc(node.comment)}</span>` : '') +
      `</div></div>`
    )
  }

  let html =
    `<div class="entity-node kind-${kind} ${node.stereotype ? `stereo-${node.stereotype}` : ''}">` +
    `<div class="entity-node__header">` +
    (stereo ? `<div class="entity-node__stereotype">«${esc(stereo)}»</div>` : '') +
    `<div class="entity-node__title">${esc(node.label)}</div>` +
    (node.comment ? `<div class="entity-node__comment">${esc(node.comment)}</div>` : '') +
    (isArch && node.category ? `<div class="entity-node__category">«${esc(node.category)}»</div>` : '') +
    `</div>`

  if (node.fields.length > 0) {
    html += `<div class="entity-node__fields">`
    if (isUml || isOntology) html += `<div class="entity-node__section-label">属性</div>`
    for (const f of node.fields) {
      html +=
        `<div class="entity-node__row ${f.primaryKey ? 'entity-node__row--pk' : ''}">` +
        `<span class="fname">` +
        (f.primaryKey ? `<span class="entity-node__pk" title="主键">🔑</span>` : '') +
        (f.foreignKey ? `<span class="entity-node__fk" title="外键">🔗</span>` : '') +
        (f.isTitle ? `<span class="entity-node__title-key" title="标题属性">★</span>` : '') +
        (isUml ? `<span class="entity-node__vis">${visSymbol(f.visibility)}</span>` : '') +
        `<span class="entity-node__fname">${esc(f.name)}</span>` +
        (f.comment ? `<span class="entity-node__fcomment" title="${esc(f.comment)}">${esc(f.comment)}</span>` : '') +
        `</span>` +
        (f.type && !isArch ? `<span class="ftype">${esc(f.type)}</span>` : '') +
        `</div>`
    }
    html += `</div>`
  }

  if (isUml && node.methods && node.methods.length > 0) {
    html += `<div class="entity-node__methods"><div class="entity-node__section-label">方法</div>`
    for (const m of node.methods) {
      const name = m.static ? `<u>${esc(m.name)}</u>` : esc(m.name)
      const italic = m.abstract ? ' style="font-style:italic"' : ''
      html +=
        `<div class="entity-node__row">` +
        `<span class="fname"${italic}>` +
        `<span class="entity-node__vis">${visSymbol(m.visibility)}</span>` +
        `${name}(${esc(m.params ?? '')})` +
        `</span>` +
        `<span class="ftype">${esc(m.returnType ?? '')}</span>` +
        `</div>`
    }
    html += `</div>`
  }

  if (node.fields.length === 0 && (!node.methods || node.methods.length === 0)) {
    html += `<div class="entity-node__empty"><span>双击编辑</span></div>`
  }

  html += `</div>`
  return html
}
