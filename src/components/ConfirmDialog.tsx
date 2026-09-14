import { useRef, useState } from 'react'
import { useApp } from '../app/AppContext'
import { useDismiss } from '../hooks/useDismiss'
import { useModalA11y } from '../hooks/useModalA11y'
import { useMessages } from '../i18n'

export function ConfirmDialog() {
  const { confirm: spec, closeConfirm } = useApp()
  const t = useMessages()
  const { closing, dismiss } = useDismiss(closeConfirm)
  const confirm = spec!
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  useModalA11y(overlayRef, dialogRef)

  return (
    <div
      ref={overlayRef}
      className={`bnt-overlay bnt-overlay-scrim${closing ? ' is-closing' : ''}`}
      style={{ zIndex: 90 }}
      onMouseDown={dismiss}
    >
      <div
        ref={dialogRef}
        className="bnt-dialog bnt-dialog-sm bnt-glass"
        role="alertdialog"
        aria-modal="true"
        tabIndex={-1}
        aria-label={confirm.title}
        style={{ width: 400 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="bnt-dialog-title">{confirm.title}</div>
        <div className="bnt-hint" style={{ fontSize: 12.5, lineHeight: 1.7 }}>
          {confirm.message}
        </div>
        {error && <div className="bnt-error">{error}</div>}
        <div className="bnt-dialog-foot">
          <span className="bnt-spacer" />
          <button type="button" className="bnt-btn-ghost" onClick={dismiss}>
            {confirm.cancelLabel ?? t.common.cancel}
          </button>
          <button
            type="button"
            className={confirm.danger ? 'bnt-btn-danger' : 'bnt-btn bnt-btn-primary bnt-btn-lg'}
            autoFocus
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              setError(null)
              try {
                await confirm.onConfirm()
                dismiss()
              } catch (cause) {
                const message = cause instanceof Error ? cause.message : String(cause)
                setError(t.common.failed(message))
                setBusy(false)
              }
            }}
          >
            {busy ? t.common.working : confirm.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
