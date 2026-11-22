/** 时序图激活条：自动模式兼容旧项目，手动模式可独立增删改。不引入新的渲染范式。 */

import { nanoid } from 'nanoid'
import type { DiagramEdge, ModelDoc } from './types'

export type ActivationMode = 'auto' | 'manual'

export interface SequenceActivation {
  id: string
  participantId: string
  /** 消息下标（含），合法区间由 clampActivation 保证 */
  from: number
  to: number
}

export function getActivationMode(doc: ModelDoc): ActivationMode {
  return doc.meta?.activationMode === 'manual' ? 'manual' : 'auto'
}

export function isNonActivatingMessage(edge: DiagramEdge): boolean {
  return edge.edgeKind === 'reply' || edge.source === edge.target
}

export function deriveAutoActivations(doc: ModelDoc): SequenceActivation[] {
  return doc.edges
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => !isNonActivatingMessage(m))
    .map(({ m, i }) => ({
      id: `auto-${m.id}`,
      participantId: m.target,
      from: i,
      to: i
    }))
}

export function clampActivation(
  a: SequenceActivation,
  messageCount: number,
  participantIds: Iterable<string>
): SequenceActivation | null {
  const ids = participantIds instanceof Set ? participantIds : new Set(participantIds)
  if (!ids.has(a.participantId)) return null
  if (messageCount <= 0) return { ...a, from: 0, to: 0 }
  const from = Math.max(0, Math.min(Math.floor(a.from), messageCount - 1))
  const to = Math.max(from, Math.min(Math.floor(a.to), messageCount - 1))
  return { ...a, from, to, id: a.id, participantId: a.participantId }
}

export function readManualActivations(doc: ModelDoc): SequenceActivation[] {
  const raw = doc.meta?.activations
  if (!Array.isArray(raw)) return []
  const ids = new Set(doc.nodes.map((n) => n.id))
  return (raw as SequenceActivation[])
    .map((a) => clampActivation(a, doc.edges.length, ids))
    .filter((a): a is SequenceActivation => !!a)
}

export function resolveActivations(doc: ModelDoc): {
  mode: ActivationMode
  activations: SequenceActivation[]
} {
  const mode = getActivationMode(doc)
  if (mode === 'auto') return { mode, activations: deriveAutoActivations(doc) }
  return { mode, activations: readManualActivations(doc) }
}

export function enableManualActivations(doc: ModelDoc): ModelDoc {
  if (getActivationMode(doc) === 'manual') return doc
  const activations = deriveAutoActivations(doc).map((a) => ({ ...a, id: `act-${nanoid()}` }))
  return { ...doc, meta: { ...(doc.meta ?? {}), activationMode: 'manual', activations } }
}

export function restoreAutoActivations(doc: ModelDoc): ModelDoc {
  return { ...doc, meta: { ...(doc.meta ?? {}), activationMode: 'auto', activations: [] } }
}

export function addActivation(doc: ModelDoc, partial?: Partial<SequenceActivation>): ModelDoc {
  const base = enableManualActivations(doc)
  const current = readManualActivations(base)
  const participantId = partial?.participantId ?? base.nodes[0]?.id
  if (!participantId) return base
  const max = Math.max(0, base.edges.length - 1)
  const draft: SequenceActivation = {
    id: `act-${nanoid()}`,
    participantId,
    from: partial?.from ?? 0,
    to: partial?.to ?? max
  }
  const clamped = clampActivation(draft, base.edges.length, base.nodes.map((n) => n.id))
  if (!clamped) return base
  return {
    ...base,
    meta: { ...(base.meta ?? {}), activationMode: 'manual', activations: [...current, clamped] }
  }
}

export function updateActivation(
  doc: ModelDoc,
  id: string,
  patch: Partial<Pick<SequenceActivation, 'participantId' | 'from' | 'to'>>
): ModelDoc {
  const base = enableManualActivations(doc)
  const current = readManualActivations(base)
  const next = current.map((a) => (a.id === id ? { ...a, ...patch } : a))
  const ids = base.nodes.map((n) => n.id)
  const clamped = next
    .map((a) => clampActivation(a, base.edges.length, ids))
    .filter((a): a is SequenceActivation => !!a)
  return { ...base, meta: { ...(base.meta ?? {}), activationMode: 'manual', activations: clamped } }
}

export function removeActivation(doc: ModelDoc, id: string): ModelDoc {
  const base = enableManualActivations(doc)
  const current = readManualActivations(base)
  return {
    ...base,
    meta: {
      ...(base.meta ?? {}),
      activationMode: 'manual',
      activations: current.filter((a) => a.id !== id)
    }
  }
}

/** 参与者或消息变化后，修剪非法手动激活条。自动模式原样返回。 */
export function pruneSequenceActivations(doc: ModelDoc): ModelDoc {
  if (getActivationMode(doc) !== 'manual') return doc
  const next = readManualActivations(doc)
  const prev = Array.isArray(doc.meta?.activations) ? (doc.meta?.activations as SequenceActivation[]) : []
  if (
    prev.length === next.length &&
    prev.every((a, i) => a.id === next[i].id && a.participantId === next[i].participantId && a.from === next[i].from && a.to === next[i].to)
  ) {
    return doc
  }
  return { ...doc, meta: { ...(doc.meta ?? {}), activationMode: 'manual', activations: next } }
}

export function activationBand(from: number, to: number, msgTop: number, msgH: number): { y: number; h: number } {
  const a = Math.min(from, to)
  const b = Math.max(from, to)
  return { y: msgTop + a * msgH - 6, h: Math.max(msgH, (b - a) * msgH + msgH) }
}

export function activationCaption(doc: ModelDoc, a: SequenceActivation): string {
  const name = doc.nodes.find((n) => n.id === a.participantId)?.label?.trim() || '参与者'
  if (a.from === a.to) return `${name} · 消息 ${a.from + 1}`
  return `${name} · 消息 ${a.from + 1}–${a.to + 1}`
}
