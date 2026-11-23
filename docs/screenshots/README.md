# 预留的产品界面截图

本目录用于存放 **真实产品窗口** 截图。当前尚未放入 PNG，因为仓库与本机工作区都没有可用的产品界面截图；`build/icon.png` 只是图标，不能替代。

**请勿**提交 AI 生成图、编造界面或装饰性插图。

## 建议启动（Linux 或 Windows 桌面）

```bash
npm install
# 若 peer 依赖冲突：npm install --legacy-peer-deps
npm run dev
```

需要 Node.js 与可运行的 Electron（`electron-vite dev`）。首次可用「内置模拟」供应商，不必填写 API Key；用行业模板生成一个模型后再截图。

## 建议截取并使用的文件名

| 文件 | 预期画面 |
| --- | --- |
| `01-workbench.png` | 主工作台：项目资源管理器、中间画布、右侧属性/状态栏 |
| `02-canvas-model.png` | 已有模型（实体/关系可见）的画布 |
| `03-ai-panel-or-export.png` | 左侧 AI 对话，或导出/生成代码与文档的界面 |

请遮盖设置页中的 API Key。截取后把上述文件放到本目录，并保持 README 中的相对路径不变，再追加提交到同一文档分支。
