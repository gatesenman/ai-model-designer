import { describe, expect, it } from 'vitest'
import {
  addActivation,
  clampActivation,
  deriveAutoActivations,
  getActivationMode,
  pruneSequenceActivations,
  removeActivation,
  resolveActivations,
  restoreAutoActivations,
  updateActivation
} from '@shared/sequenceActivations'
import { emptyDoc, useModelStore } from '@renderer/store/modelStore'
import type { ModelDoc } from '@shared/types'

function seqDoc(): ModelDoc {
  const doc = emptyDoc('uml', '时序', 'uml-sequence')
  return doc
}

describe('时序图激活条', () => {
  it('旧项目默认自动模式，激活条由非返回消息推导', () => {
    const doc = seqDoc()
    expect(getActivationMode(doc)).toBe('auto')
    const auto = deriveAutoActivations(doc)
    expect(auto.length).toBeGreaterThan(0)
    expect(resolveActivations(doc).mode).toBe('auto')
    expect(resolveActivations(doc).activations.map((a) => a.participantId)).toEqual(auto.map((a) => a.participantId))
  })

  it('首次手动新增会保留自动结果并进入手动模式；非法区间被夹紧', () => {
    const doc = seqDoc()
    const autoCount = deriveAutoActivations(doc).length
    const manual = addActivation(doc, { participantId: doc.nodes[0].id, from: -2, to: 99 })
    expect(getActivationMode(manual)).toBe('manual')
    const resolved = resolveActivations(manual)
    expect(resolved.activations.length).toBe(autoCount + 1)
    const added = resolved.activations[resolved.activations.length - 1]
    expect(added.from).toBeGreaterThanOrEqual(0)
    expect(added.to).toBeLessThan(doc.edges.length)
    expect(added.from).toBeLessThanOrEqual(added.to)
    const restored = restoreAutoActivations(manual)
    expect(getActivationMode(restored)).toBe('auto')
  })

  it('删除参与者后，指向该参与者的手动激活条被修剪；保存结构可重开', () => {
    let doc = addActivation(seqDoc(), { participantId: seqDoc().nodes[0].id })
    const pid = doc.nodes[0].id
    doc = addActivation(doc, { participantId: pid })
    const removed = {
      ...doc,
      nodes: doc.nodes.filter((n) => n.id !== pid),
      edges: doc.edges.filter((e) => e.source !== pid && e.target !== pid)
    }
    const pruned = pruneSequenceActivations(removed)
    expect(resolveActivations(pruned).activations.every((a) => a.participantId !== pid)).toBe(true)
    const text = JSON.stringify(pruned)
    const loaded = JSON.parse(text) as ModelDoc
    expect(getActivationMode(loaded)).toBe('manual')
    expect(resolveActivations(loaded).activations).toEqual(resolveActivations(pruned).activations)
  })

  it('更新激活条写入 store 后可撤销；删除激活条不删参与者', () => {
    useModelStore.getState().newProject()
    const id = useModelStore.getState().addModel('uml', '时序', 'uml-sequence')
    useModelStore.getState().switchModel(id)
    const beforeNodes = useModelStore.getState().doc.nodes.length
    const start = addActivation(useModelStore.getState().doc)
    useModelStore.getState().setDoc(start)
    const actId = resolveActivations(useModelStore.getState().doc).activations.at(-1)!.id
    const updated = updateActivation(useModelStore.getState().doc, actId, { to: 0, from: 0 })
    useModelStore.getState().setDoc(updated)
    expect(getActivationMode(useModelStore.getState().doc)).toBe('manual')
    useModelStore.getState().undo()
    useModelStore.getState().setDoc(removeActivation(useModelStore.getState().doc, actId))
    expect(useModelStore.getState().doc.nodes.length).toBe(beforeNodes)
    expect(resolveActivations(useModelStore.getState().doc).activations.every((a) => a.id !== actId)).toBe(true)
  })

  it('clampActivation 在参与者不存在时丢弃', () => {
    expect(clampActivation({ id: 'a', participantId: 'x', from: 0, to: 1 }, 2, ['a'])).toBeNull()
  })
})
