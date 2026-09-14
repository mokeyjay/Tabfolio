import type { FolderDisplaySetting, FolderMode } from '../types'
import { MAX_FOLDER_DEPTH } from '../state/settingsSchema'
import { NumberSetting, Segmented, Switch } from './ui'
import { useMessages, type Messages } from '../i18n'

function modes(t: Messages): { value: FolderMode; label: string }[] {
  return [
    { value: 'hidden', label: t.folderSetting.hidden },
    { value: 'default', label: t.folderSetting.default },
    { value: 'pinned', label: t.folderSetting.pinned },
    { value: 'expanded', label: t.folderSetting.expanded },
  ]
}

/**
 * 目录展示方案编辑器 —— 自己调用自己来编辑「子目录的展示方案」，
 * 所以「在展开的目录里继续展开子目录」在界面上就是一层套一层。
 */
export function FolderSettingEditor({
  value,
  onChange,
  depth = 0,
  label,
}: {
  value: FolderDisplaySetting
  onChange: (next: FolderDisplaySetting) => void
  depth?: number
  label?: string
}) {
  const t = useMessages()
  const patch = (p: Partial<FolderDisplaySetting>) => onChange({ ...value, ...p })
  const canNest = depth + 1 < MAX_FOLDER_DEPTH

  return (
    <div className="bnt-group">
      <div className="bnt-row">
        <span className="bnt-group-title">{label ?? t.folderSetting.label}</span>
        <span className="bnt-spacer" />
        <Segmented value={value.mode} options={modes(t)} onChange={(mode) => patch({ mode })} />
      </div>

      {value.mode === 'expanded' && (
        <div className="bnt-group" style={{ marginTop: 4 }}>
          <Switch
            on={value.expandAll}
            label={t.folderSetting.expandAll}
            onChange={(expandAll) => patch({ expandAll })}
          />
          {!value.expandAll && (
            <NumberSetting
              label={t.folderSetting.rows}
              value={value.rows}
              min={1}
              step={1}
              unit={t.folderSetting.rowsUnit}
              onChange={(rows) => patch({ rows })}
            />
          )}

          {canNest && (
            <>
              <Switch
                on={!!value.child}
                label={t.folderSetting.perChild}
                onChange={(on) =>
                  patch({
                    child: on
                      ? { mode: 'default', expandAll: false, rows: 2, child: null }
                      : null,
                  })
                }
              />
              {value.child && (
                <FolderSettingEditor
                  value={value.child}
                  depth={depth + 1}
                  label={t.folderSetting.childLabel}
                  onChange={(child) => patch({ child })}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
