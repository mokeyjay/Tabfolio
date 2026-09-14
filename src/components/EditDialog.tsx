import { useEffect, useMemo, useRef, useState } from 'react'
import type { CustomIcon } from '../types'
import { useApp } from '../app/AppContext'
import { collectFolders } from '../platform/bookmarks'
import { downscaleImage, newImageId, putImage, removeImage } from '../platform/blobs'
import { getDeviceId } from '../platform/env'
import { invalidateLocalImage, useLocalImage } from '../hooks/useLocalImage'
import { removeBookmark, saveBookmark } from '../state/bookmarksStore'
import { getMeta, updateMeta } from '../state/metaStore'
import { ensureScheme, isValidUrl } from '../utils/url'
import { splitLeadingEmoji } from '../utils/emoji'
import { BookmarkIcon } from './BookmarkIcon'
import { Field } from './ui'
import { useDismiss } from '../hooks/useDismiss'
import { useModalA11y } from '../hooks/useModalA11y'
import { IconClose, IconLink, IconReset, IconUpload } from './icons'
import { useMessages } from '../i18n'

export function EditDialog() {
  const { editNode, setEditNode, root, meta, showToast, askConfirm } = useApp()
  const t = useMessages()
  const node = editNode!
  const isFolder = !node.url
  const existing = meta[node.key] ?? {}
  const oldLocalIconId = existing.icon?.kind === 'local' ? existing.icon.id : null

  const [title, setTitle] = useState(node.title)
  const [url, setUrl] = useState(node.url ?? '')
  const [parentId, setParentId] = useState(node.parentId ?? '')
  const [icon, setIcon] = useState<CustomIcon | undefined>(existing.icon)
  const [iconUrlDraft, setIconUrlDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const temporaryImageIds = useRef(new Set<string>())
  const saved = useRef(false)

  // 不能把一个目录移动到它自己或它的子孙下面
  const folders = useMemo(
    () =>
      collectFolders(root).filter(
        (f) => !isFolder || (f.id !== node.id && !f.path.startsWith(`${node.path}/`)),
      ),
    [root, isFolder, node.id, node.path],
  )
  const localIconSrc = useLocalImage(icon?.kind === 'local' ? icon.id : undefined)

  useEffect(() => {
    titleRef.current?.focus()
    titleRef.current?.select()
  }, [])

  const { closing, dismiss: close } = useDismiss(() => {
    if (!saved.current) {
      for (const id of temporaryImageIds.current) {
        void removeImage(id).catch((cause: unknown) => {
          console.error('清理未保存的临时图标失败', cause)
        })
      }
    }
    setEditNode(null)
  })
  useModalA11y(overlayRef, dialogRef)

  const discardTemporaryIcon = async (current: CustomIcon | undefined) => {
    if (current?.kind !== 'local' || !temporaryImageIds.current.has(current.id)) return
    temporaryImageIds.current.delete(current.id)
    await removeImage(current.id)
  }

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError(t.edit.pickImageFile)
      return
    }
    try {
      const small = await downscaleImage(file, 128)
      const id = newImageId()
      await putImage(id, small)
      temporaryImageIds.current.add(id)
      invalidateLocalImage(id)
      await discardTemporaryIcon(icon)
      setIcon({ kind: 'local', id, mime: small.type, deviceId: getDeviceId() })
      setError(null)
    } catch (cause) {
      setError(t.edit.readImageFailed(cause instanceof Error ? cause.message : String(cause)))
    }
  }

  const save = async () => {
    const cleanTitle = title.trim() || node.title
    const finalUrl = isFolder ? undefined : ensureScheme(url)
    if (!isFolder && !isValidUrl(finalUrl ?? '')) {
      setError(t.edit.invalidUrl)
      return
    }
    try {
      const updated = await saveBookmark(node, {
        title: cleanTitle,
        url: finalUrl,
        parentId,
      })
      await updateMeta(updated.key, { icon })
      if (icon?.kind === 'local') temporaryImageIds.current.delete(icon.id)
      saved.current = true

      // Meta 已成功切换后才能删除旧图片；取消编辑绝不会再破坏旧引用。
      if (
        oldLocalIconId &&
        (icon?.kind !== 'local' || icon.id !== oldLocalIconId) &&
        !Object.values(getMeta()).some(
          (remaining) =>
            remaining.icon?.kind === 'local' && remaining.icon.id === oldLocalIconId,
        )
      ) {
        try {
          await removeImage(oldLocalIconId)
        } catch (cause) {
          console.error('清理旧图标失败', cause)
        }
      }
      showToast(t.edit.saved)
      close()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      setError(t.edit.saveFailed(message))
    }
  }

  const del = () => {
    askConfirm({
      title: isFolder ? t.menu.deleteFolderTitle : t.menu.deleteBookmarkTitle,
      message: isFolder
        ? t.menu.deleteFolderSynced(splitLeadingEmoji(node.title).label, node.count)
        : t.menu.deleteBookmarkMessage(node.title),
      confirmLabel: t.menu.delete,
      danger: true,
      onConfirm: async () => {
        await removeBookmark(node)
        showToast(t.menu.deleted)
        close()
      },
    })
  }

  const previewNode = {
    ...node,
    title: title || node.title,
    url: isFolder ? undefined : ensureScheme(url || 'https://example.com'),
  }
  const customSrc =
    icon?.kind === 'url' ? icon.url : icon?.kind === 'local' ? localIconSrc : null

  return (
    <div ref={overlayRef} className={`bnt-overlay${closing ? ' is-closing' : ''}`} onMouseDown={close}>
      <div
        ref={dialogRef}
        className="bnt-dialog bnt-dialog-sm bnt-glass"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-label={isFolder ? t.edit.editFolder : t.edit.editBookmark}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="bnt-dialog-head">
          <div className="bnt-dialog-title">{isFolder ? t.edit.editFolder : t.edit.editBookmark}</div>
          <span className="bnt-spacer" />
          <button type="button" className="bnt-iconbtn" aria-label={t.common.close} onClick={close}>
            <IconClose size={15} />
          </button>
        </div>

        <div className="bnt-icon-editor">
          {customSrc ? (
            <span className="bnt-icon is-image" style={{ width: 40, height: 40 }}>
              <img src={customSrc} alt="" />
            </span>
          ) : (
            <BookmarkIcon node={previewNode} size={40} />
          )}
          <div className="bnt-field">
            <span className="bnt-field-label">{t.edit.icon}</span>
            <div className="bnt-row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="bnt-inline-action"
                onClick={() => fileRef.current?.click()}
              >
                <IconUpload size={12} />
                {t.edit.uploadImage}
              </button>
              <button
                type="button"
                className="bnt-inline-action"
                onClick={() =>
                  setIconUrlDraft(iconUrlDraft === null ? (icon?.kind === 'url' ? icon.url : 'https://') : null)
                }
              >
                <IconLink size={12} />
                {t.edit.imageUrl}
              </button>
              {icon && (
                <button
                  type="button"
                  className="bnt-inline-action"
                  onClick={() => {
                    void discardTemporaryIcon(icon).then(() => {
                      setIcon(undefined)
                      setIconUrlDraft(null)
                    }).catch((cause: unknown) => {
                      setError(t.edit.cleanupFailed(String(cause)))
                    })
                  }}
                >
                  <IconReset size={12} />
                  {t.edit.restoreDefaultIcon}
                </button>
              )}
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => void pickFile(e.target.files?.[0])}
          />
        </div>

        {iconUrlDraft !== null && (
          <div className="bnt-input-group">
            <input
              autoFocus
              value={iconUrlDraft}
              placeholder={t.edit.iconUrlPlaceholder}
              onChange={(e) => setIconUrlDraft(e.target.value)}
            />
            <button
              type="button"
              className="bnt-inline-action"
              onClick={() => {
                let parsed: URL
                try {
                  parsed = new URL(iconUrlDraft.trim())
                } catch {
                  setError(t.edit.invalidIconUrl)
                  return
                }
                if (!['http:', 'https:'].includes(parsed.protocol)) {
                  setError(t.edit.iconProtocol)
                  return
                }
                void discardTemporaryIcon(icon).then(() => {
                  setIcon({ kind: 'url', url: parsed.toString() })
                  setIconUrlDraft(null)
                  setError(null)
                }).catch((cause: unknown) => {
                  setError(t.edit.cleanupFailed(String(cause)))
                })
              }}
            >
              {t.edit.useIcon}
            </button>
          </div>
        )}
        {icon?.kind === 'local' && (
          <div className="bnt-hint">
            {t.edit.localIconHint}
          </div>
        )}

        <Field label={t.edit.name}>
          <input
            ref={titleRef}
            className="bnt-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void save()}
          />
        </Field>
        {isFolder && splitLeadingEmoji(title).emoji && (
          <div className="bnt-hint">{t.edit.emojiHint}</div>
        )}

        {!isFolder && (
          <div className="bnt-field">
            <span className="bnt-field-label">{t.edit.url}</span>
            <div className="bnt-input-group">
              <input
                value={url}
                placeholder="https://"
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void save()}
              />
            </div>
          </div>
        )}

        <Field label={t.edit.parentFolder}>
          <select
            className="bnt-select"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
          >
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {'　'.repeat(f.depth)}
                {splitLeadingEmoji(f.title).label}
              </option>
            ))}
          </select>
        </Field>

        {error && <div className="bnt-error">{error}</div>}

        <div className="bnt-divider" />
        <div className="bnt-dialog-foot">
          <button type="button" className="bnt-btn-danger" onClick={del}>
            {t.common.delete}
          </button>
          <span className="bnt-spacer" />
          <button type="button" className="bnt-btn-ghost" onClick={close}>
            {t.edit.cancel}
          </button>
          <button
            type="button"
            className="bnt-btn bnt-btn-primary bnt-btn-lg"
            onClick={() => void save()}
          >
            {t.edit.save}
          </button>
        </div>
      </div>
    </div>
  )
}
