export const BOOTSTRAP_SELECTOR =
  '[data-video-id], #video-player-container, main button:not([disabled]):not([tabindex="-1"]), main a[href]:not([tabindex="-1"])'

const NAV_ATTR = 'data-nav-focus'

function clearNavFocus() {
  document.querySelectorAll(`[${NAV_ATTR}]`).forEach(el => el.removeAttribute(NAV_ATTR))
}

export function setNavFocus(el: HTMLElement) {
  clearNavFocus()
  el.setAttribute(NAV_ATTR, '')
  el.focus()
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

export function bootstrapNavFocus(): boolean {
  const activeEl = document.activeElement
  if (activeEl && activeEl !== document.body) return false
  const target = document.querySelector<HTMLElement>(BOOTSTRAP_SELECTOR)
  if (!target) return false
  setNavFocus(target)
  return true
}

export function forceBootstrapNavFocus(): boolean {
  const target = document.querySelector<HTMLElement>(BOOTSTRAP_SELECTOR)
  if (!target) return false
  setNavFocus(target)
  return true
}

export function waitForBootstrap(): () => void {
  if (bootstrapNavFocus()) return () => {}

  let rafId: number
  const observer = new MutationObserver(() => {
    cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(() => {
      if (bootstrapNavFocus()) observer.disconnect()
    })
  })

  observer.observe(document.body, { childList: true, subtree: true })

  const timeout = setTimeout(() => observer.disconnect(), 10_000)

  return () => {
    cancelAnimationFrame(rafId)
    clearTimeout(timeout)
    observer.disconnect()
  }
}

export function initNavFocusCleanup() {
  const clearOnPointer = () => clearNavFocus()

  const clearIfNative = (e: FocusEvent) => {
    const target = e.target as HTMLElement
    if (!target?.hasAttribute(NAV_ATTR)) clearNavFocus()
  }

  window.addEventListener('mousedown', clearOnPointer)
  window.addEventListener('touchstart', clearOnPointer, { passive: true })
  window.addEventListener('focusin', clearIfNative)

  return () => {
    window.removeEventListener('mousedown', clearOnPointer)
    window.removeEventListener('touchstart', clearOnPointer)
    window.removeEventListener('focusin', clearIfNative)
  }
}
