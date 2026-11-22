import { useEffect, useMemo, useRef } from 'react'
import MarkdownIt from 'markdown-it'
import mermaid from 'mermaid'
import hljs from 'highlight.js/lib/common'
import { useSettingsStore } from '../store/settingsStore'

let mermaidSeq = 0

function initMermaid(dark: boolean): void {
  mermaid.initialize({
    startOnLoad: false,
    theme: dark ? 'dark' : 'default',
    securityLevel: 'strict',
    fontFamily: 'inherit'
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function highlightFence(code: string, lang: string): string {
  if (lang === 'mermaid') {
    // 交给后续 mermaid 渲染，先输出占位容器
    return `<div class="mermaid-pending" data-src="${code.replace(/"/g, '&quot;')}"></div>`
  }
  if (lang && hljs.getLanguage(lang)) {
    try {
      return `<pre class="hljs"><code>${hljs.highlight(code, { language: lang }).value}</code></pre>`
    } catch {
      // ignore
    }
  }
  return `<pre class="hljs"><code>${escapeHtml(code)}</code></pre>`
}

function createMarkdown(): MarkdownIt {
  return new MarkdownIt({
    html: false,
    linkify: true,
    breaks: false,
    highlight: highlightFence
  })
}

export default function MarkdownView({ content }: { content: string }) {
  const theme = useSettingsStore((s) => s.settings.theme)
  const dark = theme === 'dark'
  const containerRef = useRef<HTMLDivElement>(null)

  const md = useMemo(() => createMarkdown(), [])
  const html = useMemo(() => md.render(content), [md, content])

  useEffect(() => {
    initMermaid(dark)
  }, [dark])

  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    initMermaid(dark)
    const blocks = Array.from(root.querySelectorAll<HTMLDivElement>('.mermaid-pending'))
    let cancelled = false
    blocks.forEach(async (el) => {
      const src = el.getAttribute('data-src')?.replace(/&quot;/g, '"') ?? ''
      const id = `mmd-${Date.now()}-${mermaidSeq++}`
      try {
        const { svg } = await mermaid.render(id, src)
        if (cancelled) return
        el.className = 'mermaid-rendered'
        el.innerHTML = svg
      } catch (err) {
        if (cancelled) return
        el.className = 'mermaid-error'
        el.textContent = '图表渲染失败：' + (err as Error).message + '\n\n' + src
      }
    })
    return () => {
      cancelled = true
    }
  }, [html, dark])

  return (
    <div
      ref={containerRef}
      className="markdown-view"
      // 内容来自本地 markdown-it 渲染（html:false），mermaid SVG 由 mermaid 生成
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
