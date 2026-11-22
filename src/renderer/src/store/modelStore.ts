import { create } from 'zustand'
import { nanoid } from 'nanoid'
import { pruneSequenceActivations } from '@shared/sequenceActivations'
import type {
  DiagramEdge,
  DiagramNode,
  Field,
  Method,
  ModelDoc,
  ModelKind,
  Project,
  ProjectSnapshot,
  RelationKind
} from '@shared/types'
import { getDiagramSchema, resolveTemplate } from '@shared/diagramSchema'

function now(): string {
  return new Date().toISOString()
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

const DEFAULT_TYPE_BY_KIND: Record<ModelKind, string> = {
  conceptual: 'conceptual-erd',
  logical: 'logical-erd',
  physical: 'physical-erd',
  uml: 'uml-class',
  architecture: 'flowchart'
}

export function emptyDoc(
  kind: ModelKind = 'logical',
  name = '未命名模型',
  diagramType?: string
): ModelDoc {
  const typeId = diagramType ?? DEFAULT_TYPE_BY_KIND[kind]
  const tmpl = resolveTemplate(typeId)
  return {
    id: nanoid(),
    name,
    kind,
    diagramType: typeId,
    description: '',
    nodes: tmpl.nodes,
    edges: tmpl.edges,
    meta: tmpl.meta,
    createdAt: now(),
    updatedAt: now()
  }
}

export function emptyProject(name = '未命名项目'): Project {
  const doc = emptyDoc('logical', '模型 1')
  return {
    id: nanoid(),
    name,
    description: '',
    models: [doc],
    activeModelId: doc.id,
    version: 1,
    createdAt: now(),
    updatedAt: now(),
    format: 'amdproj'
  }
}

interface HistoryState {
  past: ModelDoc[]
  future: ModelDoc[]
}

interface ModelState {
  project: Project
  doc: ModelDoc // 当前激活的模型（编辑对象）
  selectedNodeId: string | null
  selectedNodeIds: string[]
  selectedEdgeId: string | null
  selectedActivationId: string | null
  history: HistoryState
  dirty: boolean
  /** 最近一次保存/打开的 .amdproj 路径，不写入项目文件本身 */
  filePath: string | null
  // 项目级
  newProject: () => void
  loadProject: (project: Project, opts?: { dirty?: boolean; filePath?: string | null }) => void
  setFilePath: (filePath: string | null) => void
  renameProject: (name: string) => void
  setProjectMeta: (patch: Partial<Pick<Project, 'name' | 'description'>>) => void
  addModel: (kind: ModelKind, name?: string, diagramType?: string) => string
  /** 批量插入多张图（项目驱动 AI 一次生成多图用），返回新激活图 id */
  addModels: (docs: ModelDoc[]) => string | null
  switchModel: (id: string) => void
  removeModel: (id: string) => void
  duplicateModel: (id: string) => void
  renameModel: (id: string, name: string) => void
  markSaved: () => void
  // 版本快照
  saveSnapshot: (label?: string) => void
  restoreSnapshot: (id: string) => void
  deleteSnapshot: (id: string) => void
  // 文档级（作用于当前激活模型）
  setDoc: (doc: ModelDoc, recordHistory?: boolean) => void
  newDoc: (kind: ModelKind) => void
  renameDoc: (name: string) => void
  setDescription: (description: string) => void
  setKind: (kind: ModelKind) => void
  // 节点
  addNode: (partial?: Partial<DiagramNode>) => string
  updateNode: (id: string, patch: Partial<DiagramNode>) => void
  moveNode: (id: string, x: number, y: number) => void
  removeNode: (id: string) => void
  setNodes: (nodes: DiagramNode[]) => void
  // 字段
  addField: (nodeId: string, field?: Partial<Field>) => void
  updateField: (nodeId: string, fieldId: string, patch: Partial<Field>) => void
  removeField: (nodeId: string, fieldId: string) => void
  moveField: (nodeId: string, fieldId: string, dir: -1 | 1) => void
  // 方法（UML）
  addMethod: (nodeId: string, method?: Partial<Method>) => void
  updateMethod: (nodeId: string, methodId: string, patch: Partial<Method>) => void
  removeMethod: (nodeId: string, methodId: string) => void
  // 边
  addEdge: (source: string, target: string, relation?: RelationKind) => void
  updateEdge: (id: string, patch: Partial<DiagramEdge>) => void
  removeEdge: (id: string) => void
  // 选择
  selectNode: (id: string | null) => void
  toggleSelectNode: (id: string) => void
  setSelectedNodes: (ids: string[]) => void
  selectAllNodes: () => void
  clearSelection: () => void
  selectEdge: (id: string | null) => void
  selectActivation: (id: string | null) => void
  removeSelectedNodes: () => void
  // 历史
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
}

const HISTORY_LIMIT = 50

/** 把当前 doc 写回 project.models，并刷新项目时间戳 */
function syncProject(project: Project, doc: ModelDoc): Project {
  return {
    ...project,
    models: project.models.map((m) => (m.id === doc.id ? doc : m)),
    updatedAt: now()
  }
}

export const useModelStore = create<ModelState>((set, get) => {
  /** 在变更前把当前 doc 压入历史，并写回项目 */
  function commit(mutator: (doc: ModelDoc) => ModelDoc): void {
    const { doc, history, project } = get()
    const snapshot = clone(doc)
    const next = pruneSequenceActivations(mutator(clone(doc)))
    next.updatedAt = now()
    const past = [...history.past, snapshot].slice(-HISTORY_LIMIT)
    set({
      doc: next,
      history: { past, future: [] },
      project: syncProject(project, next),
      dirty: true
    })
  }

  const initial = emptyProject()
  const initialDoc = initial.models[0]

  return {
    project: initial,
    doc: initialDoc,
    selectedNodeId: null,
    selectedNodeIds: [],
    selectedEdgeId: null,
    selectedActivationId: null,
    history: { past: [], future: [] },
    dirty: false,
    filePath: null,

    newProject: () => {
      const project = emptyProject()
      set({
        project,
        doc: project.models[0],
        selectedNodeId: null,
        selectedEdgeId: null,
        selectedActivationId: null,
        history: { past: [], future: [] },
        dirty: false,
        filePath: null
      })
    },

    loadProject: (project, opts) => {
      const active =
        project.models.find((m) => m.id === project.activeModelId) ?? project.models[0]
      set({
        project,
        doc: active,
        selectedNodeId: null,
        selectedNodeIds: [],
        selectedEdgeId: null,
        selectedActivationId: null,
        history: { past: [], future: [] },
        dirty: opts?.dirty ?? false,
        filePath: opts?.filePath === undefined ? null : opts.filePath
      })
    },

    setFilePath: (filePath) => set({ filePath }),

    renameProject: (name) =>
      set((s) => ({ project: { ...s.project, name, updatedAt: now() }, dirty: true })),

    setProjectMeta: (patch) =>
      set((s) => ({ project: { ...s.project, ...patch, updatedAt: now() }, dirty: true })),

    addModel: (kind, name, diagramType) => {
      // emptyDoc 已按图种注入 resolveTemplate() 骨架
      const doc = emptyDoc(kind, name ?? `模型 ${get().project.models.length + 1}`, diagramType)
      set((s) => ({
        project: {
          ...s.project,
          models: [...s.project.models, doc],
          activeModelId: doc.id,
          updatedAt: now()
        },
        doc,
        selectedNodeId: null,
        selectedEdgeId: null,
        selectedActivationId: null,
        history: { past: [], future: [] },
        dirty: true
      }))
      return doc.id
    },

    addModels: (docs) => {
      if (docs.length === 0) return null
      const { project, doc: current } = get()
      const synced = syncProject(project, current)
      const active = docs[docs.length - 1]
      set({
        project: {
          ...synced,
          models: [...synced.models, ...docs],
          activeModelId: active.id,
          updatedAt: now()
        },
        doc: active,
        selectedNodeId: null,
        selectedNodeIds: [],
        selectedEdgeId: null,
        selectedActivationId: null,
        history: { past: [], future: [] },
        dirty: true
      })
      return active.id
    },

    saveSnapshot: (label) => {
      const { project, doc } = get()
      const synced = syncProject(project, doc)
      const version = (synced.version ?? 1) + 1
      const models = clone(synced.models)
      const snapshot: ProjectSnapshot = {
        id: nanoid(),
        version,
        label,
        createdAt: now(),
        stats: {
          models: models.length,
          nodes: models.reduce((a, m) => a + m.nodes.length, 0),
          edges: models.reduce((a, m) => a + m.edges.length, 0)
        },
        models,
        activeModelId: synced.activeModelId
      }
      set({
        project: {
          ...synced,
          version,
          snapshots: [...(synced.snapshots ?? []), snapshot],
          updatedAt: now()
        },
        dirty: true
      })
    },

    restoreSnapshot: (id) => {
      const { project } = get()
      const snap = (project.snapshots ?? []).find((s) => s.id === id)
      if (!snap) return
      const models = clone(snap.models)
      const active =
        models.find((m) => m.id === snap.activeModelId) ?? models[0]
      if (!active) return
      set({
        project: {
          ...project,
          models,
          activeModelId: active.id,
          updatedAt: now()
        },
        doc: active,
        selectedNodeId: null,
        selectedNodeIds: [],
        selectedEdgeId: null,
        selectedActivationId: null,
        history: { past: [], future: [] },
        dirty: true
      })
    },

    deleteSnapshot: (id) =>
      set((s) => ({
        project: {
          ...s.project,
          snapshots: (s.project.snapshots ?? []).filter((x) => x.id !== id),
          updatedAt: now()
        },
        dirty: true
      })),

    switchModel: (id) => {
      const { project, doc } = get()
      if (id === doc.id) return
      const synced = syncProject(project, doc)
      const target = synced.models.find((m) => m.id === id)
      if (!target) return
      set({
        project: { ...synced, activeModelId: id },
        doc: target,
        selectedNodeId: null,
        selectedEdgeId: null,
        selectedActivationId: null,
        history: { past: [], future: [] }
      })
    },

    removeModel: (id) => {
      const { project } = get()
      if (project.models.length <= 1) return
      const models = project.models.filter((m) => m.id !== id)
      const activeModelId =
        project.activeModelId === id ? models[0].id : project.activeModelId
      const active = models.find((m) => m.id === activeModelId) ?? models[0]
      set({
        project: { ...project, models, activeModelId, updatedAt: now() },
        doc: active,
        selectedNodeId: null,
        selectedEdgeId: null,
        selectedActivationId: null,
        history: { past: [], future: [] },
        dirty: true
      })
    },

    duplicateModel: (id) => {
      const { project, doc } = get()
      const synced = syncProject(project, doc)
      const src = synced.models.find((m) => m.id === id)
      if (!src) return
      const copy = clone(src)
      copy.id = nanoid()
      copy.name = `${src.name} 副本`
      copy.createdAt = now()
      copy.updatedAt = now()
      set({
        project: {
          ...synced,
          models: [...synced.models, copy],
          activeModelId: copy.id,
          updatedAt: now()
        },
        doc: copy,
        selectedNodeId: null,
        selectedEdgeId: null,
        selectedActivationId: null,
        history: { past: [], future: [] },
        dirty: true
      })
    },

    renameModel: (id, name) => {
      const { project, doc } = get()
      const models = project.models.map((m) => (m.id === id ? { ...m, name, updatedAt: now() } : m))
      const nextDoc = doc.id === id ? { ...doc, name, updatedAt: now() } : doc
      set({
        project: { ...project, models, updatedAt: now() },
        doc: nextDoc,
        dirty: true
      })
    },

    markSaved: () => set({ dirty: false }),

    setDoc: (incoming, recordHistory = true) => {
      const { project, doc: current } = get()
      // setDoc 始终作用于当前激活模型：强制沿用其 id，避免 AI 生成的新 id
      // 无法写回 project.models 而导致切换模型后内容丢失
      const doc: ModelDoc = pruneSequenceActivations({ ...incoming, id: current.id })
      if (recordHistory) {
        commit(() => clone(doc))
      } else {
        set({
          doc,
          project: syncProject(project, doc),
          history: { past: [], future: [] },
          dirty: true
        })
      }
    },

    newDoc: (kind) => get().addModel(kind),

    renameDoc: (name) => commit((d) => ({ ...d, name })),
    setDescription: (description) => commit((d) => ({ ...d, description })),
    setKind: (kind) => commit((d) => ({ ...d, kind })),

    addNode: (partial) => {
      const id = partial?.id ?? nanoid()
      commit((d) => {
        const schema = getDiagramSchema(d.diagramType)
        const kind =
          schema.nodeKinds.find((k) => k.id === partial?.nodeKind) ?? schema.nodeKinds[0]
        const labelBase = kind?.label ?? '节点'
        const defaultLabel = `${labelBase}${d.nodes.length + 1}`
        const node: DiagramNode = {
          id,
          label: partial?.label ?? defaultLabel,
          fields: partial?.fields ?? [],
          methods: partial?.methods,
          comment: partial?.comment,
          category: partial?.category ?? kind?.category,
          stereotype:
            partial?.stereotype ??
            kind?.defaultStereotype ??
            (d.kind === 'uml' ? 'class' : undefined),
          nodeKind: partial?.nodeKind ?? kind?.id,
          props: partial?.props,
          position: partial?.position ?? {
            x: 80 + (d.nodes.length % 5) * 60,
            y: 80 + (d.nodes.length % 5) * 60
          }
        }
        return { ...d, nodes: [...d.nodes, node] }
      })
      return id
    },

    updateNode: (id, patch) =>
      commit((d) => ({
        ...d,
        nodes: d.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n))
      })),

    moveNode: (id, x, y) =>
      set((s) => {
        const doc = {
          ...s.doc,
          nodes: s.doc.nodes.map((n) =>
            n.id === id ? { ...n, position: { x, y } } : n
          )
        }
        return { doc, project: syncProject(s.project, doc), dirty: true }
      }),

    setNodes: (nodes) => commit((d) => ({ ...d, nodes })),

    removeNode: (id) =>
      commit((d) => ({
        ...d,
        nodes: d.nodes.filter((n) => n.id !== id),
        edges: d.edges.filter((e) => e.source !== id && e.target !== id)
      })),

    addField: (nodeId, field) =>
      commit((d) => ({
        ...d,
        nodes: d.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                fields: [
                  ...n.fields,
                  {
                    id: nanoid(),
                    name: field?.name ?? 'field',
                    type: field?.type ?? 'string',
                    ...field
                  }
                ]
              }
            : n
        )
      })),

    updateField: (nodeId, fieldId, patch) =>
      commit((d) => ({
        ...d,
        nodes: d.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                fields: n.fields.map((f) =>
                  f.id === fieldId ? { ...f, ...patch } : f
                )
              }
            : n
        )
      })),

    removeField: (nodeId, fieldId) =>
      commit((d) => ({
        ...d,
        nodes: d.nodes.map((n) =>
          n.id === nodeId
            ? { ...n, fields: n.fields.filter((f) => f.id !== fieldId) }
            : n
        )
      })),

    moveField: (nodeId, fieldId, dir) =>
      commit((d) => ({
        ...d,
        nodes: d.nodes.map((n) => {
          if (n.id !== nodeId) return n
          const idx = n.fields.findIndex((f) => f.id === fieldId)
          const swap = idx + dir
          if (idx < 0 || swap < 0 || swap >= n.fields.length) return n
          const fields = [...n.fields]
          ;[fields[idx], fields[swap]] = [fields[swap], fields[idx]]
          return { ...n, fields }
        })
      })),

    addMethod: (nodeId, method) =>
      commit((d) => ({
        ...d,
        nodes: d.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                methods: [
                  ...(n.methods ?? []),
                  {
                    id: nanoid(),
                    name: method?.name ?? 'method',
                    returnType: method?.returnType ?? 'void',
                    params: method?.params ?? '',
                    visibility: method?.visibility ?? 'public',
                    ...method
                  }
                ]
              }
            : n
        )
      })),

    updateMethod: (nodeId, methodId, patch) =>
      commit((d) => ({
        ...d,
        nodes: d.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                methods: (n.methods ?? []).map((m) =>
                  m.id === methodId ? { ...m, ...patch } : m
                )
              }
            : n
        )
      })),

    removeMethod: (nodeId, methodId) =>
      commit((d) => ({
        ...d,
        nodes: d.nodes.map((n) =>
          n.id === nodeId
            ? { ...n, methods: (n.methods ?? []).filter((m) => m.id !== methodId) }
            : n
        )
      })),

    addEdge: (source, target, relation = 'association') =>
      commit((d) => {
        if (source === target) return d
        const exists = d.edges.some(
          (e) => e.source === source && e.target === target
        )
        if (exists) return d
        const edge: DiagramEdge = { id: nanoid(), source, target, relation }
        return { ...d, edges: [...d.edges, edge] }
      }),

    updateEdge: (id, patch) =>
      commit((d) => ({
        ...d,
        edges: d.edges.map((e) => (e.id === id ? { ...e, ...patch } : e))
      })),

    removeEdge: (id) =>
      commit((d) => ({ ...d, edges: d.edges.filter((e) => e.id !== id) })),

    selectNode: (id) => set({ selectedNodeId: id, selectedNodeIds: id ? [id] : [], selectedEdgeId: null, selectedActivationId: null }),
    toggleSelectNode: (id) => {
      const { selectedNodeIds } = get()
      const next = selectedNodeIds.includes(id)
        ? selectedNodeIds.filter((x) => x !== id)
        : [...selectedNodeIds, id]
      set({ selectedNodeIds: next, selectedNodeId: next[next.length - 1] ?? null, selectedEdgeId: null, selectedActivationId: null })
    },
    setSelectedNodes: (ids) => {
      const cur = get().selectedNodeIds
      if (cur.length === ids.length && ids.every((id) => cur.includes(id))) return
      set({
        selectedNodeIds: ids,
        selectedNodeId: ids[ids.length - 1] ?? null,
        selectedEdgeId: null,
        selectedActivationId: null
      })
    },
    selectAllNodes: () => {
      const ids = get().doc.nodes.map((n) => n.id)
      set({ selectedNodeIds: ids, selectedNodeId: ids[ids.length - 1] ?? null, selectedEdgeId: null, selectedActivationId: null })
    },
    clearSelection: () => set({ selectedNodeId: null, selectedNodeIds: [], selectedEdgeId: null, selectedActivationId: null }),
    selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null, selectedNodeIds: [], selectedActivationId: null }),
    selectActivation: (id) => set({ selectedActivationId: id, selectedNodeId: null, selectedNodeIds: [], selectedEdgeId: null }),
    removeSelectedNodes: () => {
      const { selectedNodeIds } = get()
      if (selectedNodeIds.length === 0) return
      commit((d) => ({
        ...d,
        nodes: d.nodes.filter((n) => !selectedNodeIds.includes(n.id)),
        edges: d.edges.filter((e) => !selectedNodeIds.includes(e.source) && !selectedNodeIds.includes(e.target))
      }))
      set({ selectedNodeId: null, selectedNodeIds: [], selectedActivationId: null })
    },

    undo: () => {
      const { history, doc, project } = get()
      if (history.past.length === 0) return
      const previous = history.past[history.past.length - 1]
      const past = history.past.slice(0, -1)
      const future = [clone(doc), ...history.future]
      set({
        doc: previous,
        history: { past, future },
        project: syncProject(project, previous),
        dirty: true
      })
    },

    redo: () => {
      const { history, doc, project } = get()
      if (history.future.length === 0) return
      const next = history.future[0]
      const future = history.future.slice(1)
      const past = [...history.past, clone(doc)]
      set({
        doc: next,
        history: { past, future },
        project: syncProject(project, next),
        dirty: true
      })
    },

    canUndo: () => get().history.past.length > 0,
    canRedo: () => get().history.future.length > 0
  }
})
