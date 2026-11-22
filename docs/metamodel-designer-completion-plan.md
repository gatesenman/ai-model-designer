# 元模型与图形设计器补完整 —— 规划文档

> 目标：把**全部 104 个图种的元模型（中间 Schema）**和**各范式的设计器组件 / 编辑器**补完整。
> 范围仅限渲染与元模型层，不改 Zustand store 架构、不改 104 图种目录、不提交 GitHub。

---

## 0. 现状审计（问题清单）

### 元模型层 (`src/shared/diagramSchema.ts`, `src/shared/diagramRender.ts`)
- **P1 `getDiagramSchema()` 丢失 `diagramProps`**：返回体（diagramSchema.ts:1263-1270）未带 `diagramProps`，导致"图级属性"永远不显示。
- **P2 无 `template` 概念**：新建图都是空白，没有起始骨架。
- **P3 `renderKind` 与 Schema 分离且覆盖不全**：范式判定在 `diagramRender.ts` 的 `RENDER_KIND_BY_TYPE`，仅显式覆盖 **33/104**，其余 71 兜底 `graph`。多种本应非节点连线的图落在 graph（`uml-activity`/`uml-state`/`sysml-*` 行为图 / `user-flow` / `togaf-adm` 等）。
- **P4 范式专属元模型缺失**：sequence/matrix/tree/timeline/swimlane 各范式没有自己的元素定义（生命线/消息、行/列/单元格、里程碑/轨道、泳道），渲染器各自硬编码，未与 Schema 打通。

### 设计器/编辑器层 (`src/renderer/src/canvas/**`, `panels/PropertiesPanel.tsx`)
- **P5 只有 graph（D3GraphCanvas）是完整编辑器**：增删/拖拽/连线/多选/属性齐全。
- **P6 其余 5 个范式渲染器功能参差**：Sequence/Swimlane/Matrix/Tree/Timeline 的"增删改 + 拖拽 + 连接 + 选中回写 + 属性联动"需逐个补齐。
- **P7 `PropertiesPanel` 只认 graph 节点**：选中范式专属元素（消息/单元格/泳道/里程碑/树节点）时无对应编辑器；也没有 `diagramProps` 图级属性区。

---

## 1. 实施计划（按数据流顺序，符号级）

### Phase A — 统一并补全元模型（地基）

**`src/shared/diagramSchema.ts`**
```ts
// 把 renderKind 收进 Schema；新增范式专属元模型字段与模板
export interface DiagramSchema {
  typeId: string
  engine: ModelKind
  renderKind: RenderKind            // 新增：范式判定的唯一真源
  nodeKinds: NodeKindDef[]
  edgeKinds: EdgeKindDef[]
  nodeProps?: PropDef[]
  diagramProps?: PropDef[]
  laneKinds?: NodeKindDef[]         // 新增：泳道范式的道种类
  axis?: { unit: string; steps: number } // 新增：时间轴刻度定义
  template?: ModelDoc               // 新增：起始骨架
  genHint: string
}

// 修复：返回体补 diagramProps；解析 renderKind + template
export function getDiagramSchema(typeId?: string): DiagramSchema

// 新增：每范式给一份最小可用骨架
export function resolveTemplate(typeId?: string): ModelDoc
```

**`src/shared/diagramRender.ts`**
```ts
// RENDER_KIND_BY_TYPE 补齐到 104 全覆盖（逐组标注）
// getRenderKind() 改为优先读 getDiagramSchema().renderKind
export function getRenderKind(typeId?: string): RenderKind
```

**`src/renderer/src/store/modelStore.ts`**
```ts
// addModel 新建图时注入 resolveTemplate() 骨架
addModel: (kind, diagramType?) => ...
```

### Phase B — 补全 5 个范式设计器为"完整编辑器"

各渲染器统一补：增删元素、拖拽/排序、双击改名、连接、选中回写 `selectedNodeId(s)`，全部读写 `modelStore`（不改 store 架构）。
- `canvas/renderers/SequenceCanvas.tsx` — 参与者增删/排序、消息增删/改类型/改文案、激活条
- `canvas/renderers/SwimlaneCanvas.tsx` — 泳道增删/改名、节点跨道拖拽、顺序流连接
- `canvas/renderers/MatrixCanvas.tsx` — 行/列增删改、单元格条目增删改、拖拽移动
- `canvas/renderers/TreeCanvas.tsx` — 子节点增删、拖拽换父、双击改名、折叠
- `canvas/renderers/TimelineCanvas.tsx` — 轨道/阶段增删、里程碑增删/拖拽起止

### Phase C — 属性面板按范式分发

**`src/renderer/src/panels/PropertiesPanel.tsx`**
```ts
// 按 getRenderKind(doc.diagramType) 分发出各范式属性子编辑器
//  - sequence: 消息(类型/文案/激活)
//  - swimlane: 泳道(名/角色) + 节点
//  - matrix:   单元格(行列/条目)
//  - tree:     树节点(父/层级)
//  - timeline: 里程碑(起止/轨道)
// 补上 diagramProps 图级属性区
```

### Phase D — 质量门与交付
- `npm run typecheck` / `npm run lint` / `npm run build` 全 0 错误
- 重建 Windows exe（electron-builder）
- 打包源码 zip（排除 node_modules/release/out/dist/.git）

---

## 2. 并行执行拆解（10 个工作单元）

> 说明：中央文件（diagramSchema.ts / diagramRender.ts / PropertiesPanel.tsx）耦合度高，需先做 A 再并行 B/C。

| # | 工作单元 | 主要文件 | 依赖 |
|---|---------|---------|------|
| 1 | Schema 接口 + getDiagramSchema 修复 + renderKind 收编 | diagramSchema.ts, diagramRender.ts | 无（地基，先做） |
| 2 | resolveTemplate 各范式骨架 + addModel 注入 | diagramSchema.ts, modelStore.ts | #1 |
| 3 | renderKind 104 全覆盖审计与标注 | diagramRender.ts | #1 |
| 4 | SequenceCanvas 完整编辑器 | SequenceCanvas.tsx | #1 |
| 5 | SwimlaneCanvas 完整编辑器 | SwimlaneCanvas.tsx | #1 |
| 6 | MatrixCanvas 完整编辑器 | MatrixCanvas.tsx | #1 |
| 7 | TreeCanvas 完整编辑器 | TreeCanvas.tsx | #1 |
| 8 | TimelineCanvas 完整编辑器 | TimelineCanvas.tsx | #1 |
| 9 | PropertiesPanel 范式分发 + diagramProps 区 | PropertiesPanel.tsx | #1,#4-8 接口 |
| 10 | 质量门 + exe 重建 + zip 打包 + 端到端验证 | 全量 | 全部 |

---

## 3. 约束与验收
- 不改：5 范式之外的分类、Zustand store 架构、104 图种目录、node/edge 数据模型核心。
- 验收：每图种能解析出含 renderKind 的完整 Schema；每范式渲染器可增删改 + 属性联动；tsc/lint/build 0 错误；exe 可运行。
