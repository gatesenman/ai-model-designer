import { toPng, toSvg } from 'html-to-image'
import { jsPDF } from 'jspdf'
import type { ExportFormat, ModelDoc } from '@shared/types'
import { generateCode, generateRequirementDoc } from '../generate/generators'

export interface ExportResult {
  data: string
  encoding: 'utf8' | 'base64'
  ext: string
  mime: string
}

export function toJSON(doc: ModelDoc): ExportResult {
  return {
    data: JSON.stringify(doc, null, 2),
    encoding: 'utf8',
    ext: 'json',
    mime: 'application/json'
  }
}

export function toSQL(doc: ModelDoc): ExportResult {
  return {
    data: generateCode(doc, 'sql', { sqlDialect: 'mysql', naming: 'snake_case' }),
    encoding: 'utf8',
    ext: 'sql',
    mime: 'text/plain'
  }
}

export function toMarkdown(doc: ModelDoc): ExportResult {
  return {
    data: generateRequirementDoc(doc),
    encoding: 'utf8',
    ext: 'md',
    mime: 'text/markdown'
  }
}

/** 找到画布渲染区域用于截图（D3 图引擎或范式渲染器） */
function getFlowElement(): HTMLElement {
  const el =
    (document.querySelector('.d3-graph') as HTMLElement) ||
    (document.querySelector('.seq-canvas') as HTMLElement) ||
    (document.querySelector('.swl-canvas') as HTMLElement) ||
    (document.querySelector('.mx-canvas') as HTMLElement) ||
    (document.querySelector('.tree-canvas') as HTMLElement) ||
    (document.querySelector('.tl-canvas') as HTMLElement) ||
    (document.querySelector('.center-canvas') as HTMLElement) ||
    (document.querySelector('.rc-canvas') as HTMLElement)
  if (!el) throw new Error('未找到画布元素')
  return el
}

async function dataUrl(format: 'png' | 'svg'): Promise<string> {
  const el = getFlowElement()
  const opts = { backgroundColor: '#ffffff', pixelRatio: 2, cacheBust: true }
  return format === 'png' ? toPng(el, opts) : toSvg(el, opts)
}

export async function toPNG(): Promise<ExportResult> {
  const url = await dataUrl('png')
  return {
    data: url.replace(/^data:image\/png;base64,/, ''),
    encoding: 'base64',
    ext: 'png',
    mime: 'image/png'
  }
}

export async function toSVG(): Promise<ExportResult> {
  const url = await dataUrl('svg')
  // html-to-image 的 svg 是 data:image/svg+xml;charset=utf-8,<...>（URL 编码）
  const prefix = 'data:image/svg+xml;charset=utf-8,'
  const raw = url.startsWith(prefix)
    ? decodeURIComponent(url.slice(prefix.length))
    : url
  return { data: raw, encoding: 'utf8', ext: 'svg', mime: 'image/svg+xml' }
}

export async function toPDF(doc: ModelDoc): Promise<ExportResult> {
  const png = await dataUrl('png')
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = png
  })
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  // 标题
  pdf.setFontSize(16)
  pdf.text(doc.name, 40, 40)
  const maxW = pageW - 80
  const maxH = pageH - 80
  const ratio = Math.min(maxW / img.width, maxH / img.height)
  const w = img.width * ratio
  const h = img.height * ratio
  pdf.addImage(png, 'PNG', 40, 60, w, h)
  const base64 = pdf.output('datauristring').split(',')[1]
  return { data: base64, encoding: 'base64', ext: 'pdf', mime: 'application/pdf' }
}

export async function exportModel(
  doc: ModelDoc,
  format: ExportFormat
): Promise<ExportResult> {
  switch (format) {
    case 'json':
      return toJSON(doc)
    case 'sql':
      return toSQL(doc)
    case 'markdown':
      return toMarkdown(doc)
    case 'png':
      return toPNG()
    case 'svg':
      return toSVG()
    case 'pdf':
      return toPDF(doc)
  }
}
