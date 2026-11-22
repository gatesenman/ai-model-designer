# AI Model Designer

企业建模设计器桌面应用（Electron + React + TypeScript），当前版本 1.2.0。

基于 AI 的**概念 / 逻辑 / 物理 / UML / 架构**模型设计桌面软件。以「项目」为中心组织多个模型，支持用自然语言生成模型、在画布上手动二次微调、AI 局部微调、模型校验、基于模型生成 **AI 可理解的 Markdown 规格** 与多语言代码 / 数据 / 文档，并一键批量导出全部产物。

> 技术栈：Electron + React + TypeScript + Vite + D3 + Zustand + Ant Design。

---

## 功能特性

### 1. 多种模型类型
- **概念模型**：实体 + 关系
- **逻辑模型**：实体 + 属性 + 主键 / 外键 + 关系
- **物理模型**：数据表 + 具体 SQL 类型 + 主外键 / 唯一 / 非空 / 自增 / 默认值约束
- **UML 类图**：类 + 属性（可见性）+ 方法 + 关联 / 继承 / 组合等
- **架构图**：组件 / 服务 + 依赖关系

### 2. 项目与持久化（企业级）
- **项目（Project）**：一个项目可包含多个模型，左侧「项目」资源管理器可新建 / 切换 / 重命名 / 复制 / 删除模型
- **项目文件 `.amdproj`**：保存 / 打开整个项目；兼容导入单模型 JSON
- **自动保存**：可配置间隔（秒）自动保存到本机，重启后自动恢复上次项目

### 3. 聊天式 AI 生成与微调
- **对话式交互**：左侧 AI 面板为聊天界面（消息气泡历史 + 底部输入框，回车发送、Shift+Enter 换行）
- **自动判定生成/微调**：画布为空时自动「生成新模型」，已有模型时自动「微调现有模型」；也可手动切换「自动 / 生成 / 微调」
- **AI 生成新模型**：用自然语言描述业务需求，一键生成完整模型并自动布局
- **AI 局部微调**：对整个模型或选中节点下达自然语言指令做增量调整（作用范围可选）
- **本体语义建模（Palantir 风格）**：概念模型按 Object Type / Property / Link Type(带基数) / Action Type / Value Type 等本体范式生成
- **多供应商支持**：OpenAI、Anthropic(Claude)、Azure OpenAI、DeepSeek、通义千问(Qwen)、Ollama(本地)
- **内置模拟模式（无需任何 API Key）**：内置 9 大行业模板（电商 / 博客 / 教务 / CRM / HR / 物流 / 金融 / IoT / 医疗），关键词匹配离线生成，开箱即用

### 4. 可视化画布二次编辑
- 六种渲染范式：节点连线（D3）、时序、泳道、矩阵、树、时间轴；104 图种均有显式映射与起始模板
- 画布工具栏：新增节点 / 自动布局 / 适应视图 / 缩放 / 删除（范式画布另有参与者、泳道、行列、轨道等专用操作）
- 拖拽节点、连线建立关系；矩阵条目可跨格拖拽；树节点可拖拽换父（循环会被拒绝）
- 选中元素后右侧属性面板按范式分发；无选中时可打开「属性」查看/编辑图级属性
- 撤销 / 重做

### 5. 模型校验（领域专家能力）
内置可插拔校验规则，按 错误 / 警告 / 提示 分级显示，点击问题即可在画布定位：
- 模型为空、实体无字段、缺少主键、孤立节点（无任何关系）
- 命名规范、字段类型缺失（物理模型）、重名实体 / 字段
- 外键字段无对应关系、悬空关系（端点不存在）等

### 6. 基于模型生成
- **代码（12 种目标）**：SQL DDL、Java POJO / JPA、Python dataclass / SQLAlchemy / Pydantic、TypeScript interface / TypeORM / Prisma、Mongoose、Go struct、C# class
  - **5 种 SQL 方言**：MySQL / PostgreSQL / SQL Server / Oracle / SQLite
  - **命名风格**：snake_case / camelCase / PascalCase / 原样
- **文档**：**AI 规格说明（机器可读 Markdown + YAML，供 AI 解析重建系统）**、数据字典、需求文档、AI 开发提示词
- **数据**：样例数据 JSON / CSV / SQL INSERT

### 7. 导出与批量导出
- 单模型导出：**JSON、SQL DDL、Markdown、PNG、SVG、PDF**
- **一键批量导出**：将当前模型 / 整个项目的全部产物（代码 + 文档 + 数据 + 模型 JSON）导出到所选文件夹
- 导入：从 `.amdproj` 或 JSON 恢复

### 8. 企业级 UI / 交互
- **菜单驱动**：新建项目 / 新建模型（按类型的子菜单）/ 打开 / 保存 / 导出 / 撤销 / 重做等文件与编辑操作统一收进顶部原生菜单栏（文件 / 编辑 / 视图 / 生成 / 帮助）+ 快捷键（Ctrl+N/O/S/E/T 等），顶栏保持简洁
- 底部状态栏（项目 / 模型类型 / 实体·关系数 / 校验结果 / 供应商 / 保存状态）
- **浅色 / 深色主题**切换，全局一致
- 设置中心：通用（主题 / 自动保存 / 默认模型类型）、代码生成默认项（方言 / 命名）、AI 供应商

---

## 环境要求
- Node.js ≥ 18（开发使用 20.x）
- npm ≥ 9
- Windows / macOS / Linux（打包脚本默认产出 Windows 安装包）

## 安装

```bash
npm install
# 若遇到 peer 依赖冲突，使用：
npm install --legacy-peer-deps
```

## 开发运行

```bash
npm run dev
```

## 生产预览（运行已构建产物）

```bash
npm run build
npm run start
```

## 打包桌面安装程序

```bash
# Windows 安装包 (NSIS)，产物在 release/ 目录
npm run package

# 仅打包为免安装目录（调试用）
npm run package:dir
```

## 代码检查

```bash
npm run typecheck   # TypeScript 类型检查
npm run lint        # ESLint
npm test            # Vitest（目录/Schema 一致性、模板、编辑状态、保存重载、文本导出）
```

---

## 配置 AI 供应商

首次启动默认使用「内置模拟」供应商，**无需任何 Key 即可生成模型与各类产物**。

点击右上角 **设置** 选择真实供应商并填写：
- **OpenAI / DeepSeek / 通义千问 / Ollama**：填写 API Key（Ollama 无需），可选自定义 Base URL 与模型名
- **Azure OpenAI**：填写 API Key、资源端点(Base URL)、部署名(Deployment)、API Version
- **Anthropic**：填写 API Key 与模型名

API Key 通过 `electron-store` 加密存储在本机用户数据目录，不会上传。AI 请求统一在主进程发起以规避浏览器 CORS 限制。

---

## 目录结构

```
src/
  shared/
    types.ts                 # 共享类型（项目、模型、字段、关系、供应商、产物目标、IPC 通道）
    diagramCatalog.ts        # 104 图种目录
    diagramRender.ts         # 渲染范式（graph/sequence/swimlane/matrix/tree/timeline）映射
    diagramSchema.ts         # 图种元模型、布局种子与新建模板
    editOps.ts               # 树换父（含循环保护）与矩阵跨格移动
  main/                      # Electron 主进程
    index.ts                 # 窗口创建 + 原生菜单栏（菜单事件经 IPC 下发渲染层）
    ipc.ts                   # IPC：AI 调用、设置、项目读写、文件保存/打开、批量导出目录
    ai.ts                    # 各 AI 供应商 HTTP 调用（主进程发起）
    settings.ts              # 加密设置存储（含主题/自动保存/代码生成默认项）
    project.ts               # 项目自动保存/恢复存储
  preload/index.ts           # 安全暴露 window.api（含 onMenuEvent / saveDirFiles）
  renderer/
    index.html
    src/
      App.tsx                # 企业级布局：菜单工具条 + 左/中/右三栏 + 状态栏
      main.tsx               # 主题加载与 Ant Design 暗色算法
      store/
        modelStore.ts        # Zustand：项目 + 多模型 + 撤销/重做 + 校验联动
        settingsStore.ts     # 设置（主题/自动保存/代码生成默认/供应商）
      canvas/
        CanvasHost.tsx       # 按 renderKind 分发到 D3 图或五范式渲染器
        D3GraphCanvas.tsx    # 通用节点-连线画布（D3）
        layout.ts            # 自动布局算法
        renderers/           # 时序 / 泳道 / 矩阵 / 树 / 时间轴完整编辑器
        d3/                  # 节点 HTML、几何与样式
      validation/validationEngine.ts # 模型校验规则引擎
      project/projectFile.ts # .amdproj 保存/打开
      ai/
        aiClient.ts          # 生成/微调/产物 统一入口 + JSON 规范化
        prompts.ts           # 提示词模板
        mockGenerator.ts     # 内置模拟生成器（9 大行业模板，离线无需 Key）
      generate/generators.ts # 代码(12 目标/5 方言)/数据/文档/AI规格 + 批量产物
      export/exporters.ts    # JSON/SQL/MD/PNG/SVG/PDF 导出
      panels/                # AIPanel / ProjectExplorer / PropertiesPanel /
                             # GeneratePanel / ValidationPanel / ExportPanel / SettingsModal
```

## 使用流程（推荐）
1. 左侧「AI」输入需求 → **生成**（自动布局）；或顶部「新建模型」加入更多模型，左侧「项目」切换
2. 在画布上拖拽、连线，右侧「属性」面板微调字段与关系
3. 需要增量调整时，在左侧聊天面板继续发送微调指令（可仅作用于选中节点）
4. 右侧「校验」标签：查看并定位模型问题
5. 右侧「生成」标签：选择 代码 / 文档 / 数据 类别与目标（含 AI 可理解的 Markdown 规格）
6. 右侧「导出」标签：单项导出，或**一键批量导出**模型 / 项目的全部产物到文件夹
7. 顶部「保存」为 `.amdproj` 项目文件；自动保存默认开启，重启自动恢复

## 文档
- [功能成熟度清单](docs/功能成熟度清单.md)
- [验收说明](docs/验收说明.md)

## 许可证
MIT
