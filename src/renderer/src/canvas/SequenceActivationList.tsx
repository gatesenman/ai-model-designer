import { Button } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { useModelStore } from '../store/modelStore'
import {
  activationCaption,
  removeActivation,
  resolveActivations
} from '@shared/sequenceActivations'

/** 可发现的激活条列表入口：不依赖 SVG 命中，点击即选中并交给属性面板编辑。 */
export default function SequenceActivationList(): JSX.Element {
  const doc = useModelStore((s) => s.doc)
  const selectedActivationId = useModelStore((s) => s.selectedActivationId)
  const selectActivation = useModelStore((s) => s.selectActivation)
  const setDoc = useModelStore((s) => s.setDoc)
  const { mode, activations } = resolveActivations(doc)

  return (
    <div className="seq-activation-list" data-testid="seq-activation-list">
      <span className="seq-activation-list__label">
        激活条{mode === 'manual' ? '（手动）' : '（自动）'}
      </span>
      {activations.length === 0 ? (
        <span className="seq-activation-list__empty">暂无。可用工具栏「激活条」新增。</span>
      ) : (
        activations.map((a) => (
          <span key={a.id} className="seq-activation-list__item-wrap">
            <button
              type="button"
              data-testid={`seq-activation-list-${a.id}`}
              className={`seq-activation-list__item${selectedActivationId === a.id ? ' is-selected' : ''}`}
              onClick={() => selectActivation(a.id)}
            >
              {activationCaption(doc, a)}
            </button>
            {mode === 'manual' && (
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                data-testid={`seq-activation-list-del-${a.id}`}
                title="删除此激活条"
                onClick={(e) => {
                  e.stopPropagation()
                  setDoc(removeActivation(doc, a.id))
                  if (selectedActivationId === a.id) selectActivation(null)
                }}
              />
            )}
          </span>
        ))
      )}
    </div>
  )
}
