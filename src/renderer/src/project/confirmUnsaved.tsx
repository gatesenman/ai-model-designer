import { Button, Modal, Space } from 'antd'
import { createRoot, type Root } from 'react-dom/client'

export type UnsavedChoice = 'save' | 'discard' | 'cancel'

/**
 * IDE 式三按钮确认：保存 / 不保存 / 取消。
 * 不使用会把「取消」与「不保存」挤在一起的默认 Modal.confirm。
 */
export function confirmUnsaved(fileHint?: string | null): Promise<UnsavedChoice> {
  return new Promise((resolve) => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root: Root = createRoot(host)
    const finish = (choice: UnsavedChoice): void => {
      root.unmount()
      host.remove()
      resolve(choice)
    }
    root.render(
      <Modal
        open
        title="有未保存的更改"
        closable
        maskClosable={false}
        onCancel={() => finish('cancel')}
        footer={
          <Space>
            <Button onClick={() => finish('cancel')}>取消</Button>
            <Button onClick={() => finish('discard')}>不保存</Button>
            <Button type="primary" onClick={() => finish('save')}>
              保存
            </Button>
          </Space>
        }
      >
        <p>
          当前项目有尚未写入{fileHint ? `「${fileHint}」` : '项目文件'}的更改。
          若直接离开，这些更改不会出现在 .amdproj 中（自动暂存仅用于本机恢复，不能代替保存）。
        </p>
      </Modal>
    )
  })
}
