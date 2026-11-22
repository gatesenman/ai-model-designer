import { useEffect } from 'react'
import { useModelStore } from '../store/modelStore'

/** Delete / Backspace 删除当前选中的节点或连线（输入框内不触发） */
export function useCanvasHotkeys(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const t = e.target as HTMLElement | null
      if (!t) return
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) {
        return
      }
      const st = useModelStore.getState()
      if (st.selectedEdgeId) {
        e.preventDefault()
        st.removeEdge(st.selectedEdgeId)
        return
      }
      if (st.selectedNodeIds.length > 0 || st.selectedNodeId) {
        e.preventDefault()
        st.removeSelectedNodes()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
