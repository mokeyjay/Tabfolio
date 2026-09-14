import { useEffect, type RefObject } from 'react'

interface ModalLayer {
  overlay: HTMLElement
  dialog: HTMLElement
}

const layers: ModalLayer[] = []

function setInert(element: Element | null, inert: boolean): void {
  if (!element) return
  if (inert) element.setAttribute('inert', '')
  else element.removeAttribute('inert')
}

function refreshLayers(): void {
  setInert(document.querySelector('.bnt-app'), layers.length > 0)
  const top = layers.at(-1)
  for (const layer of layers) setInert(layer.overlay, layer !== top)
}

function focusable(dialog: HTMLElement): HTMLElement[] {
  return [...dialog.querySelectorAll<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => element.getClientRects().length > 0)
}

/** 让最上层弹窗独占可访问树、锁住 Tab，并在关闭后恢复原焦点。 */
export function useModalA11y(
  overlayRef: RefObject<HTMLElement | null>,
  dialogRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const overlay = overlayRef.current
    const dialog = dialogRef.current
    if (!overlay || !dialog) return

    const previousFocus = document.activeElement as HTMLElement | null
    const layer = { overlay, dialog }
    layers.push(layer)
    refreshLayers()

    if (!dialog.contains(document.activeElement)) {
      ;(focusable(dialog)[0] ?? dialog).focus()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || layers.at(-1) !== layer) return
      const items = focusable(dialog)
      if (!items.length) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = items[0]
      const last = items.at(-1)!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)

    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      const index = layers.indexOf(layer)
      if (index >= 0) layers.splice(index, 1)
      setInert(overlay, false)
      refreshLayers()
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [dialogRef, overlayRef])
}
