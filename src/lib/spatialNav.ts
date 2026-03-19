import type { InputIntent } from './inputMap'
import { setNavFocus, bootstrapNavFocus, forceBootstrapNavFocus } from './focusManager'

const INTENT_TO_KEY: Record<string, string> = {
  nav_up: 'ArrowUp',
  nav_down: 'ArrowDown',
  nav_left: 'ArrowLeft',
  nav_right: 'ArrowRight',
}

export function handleSpatialNav(intent: InputIntent, event?: KeyboardEvent): void {
  const key = INTENT_TO_KEY[intent]
  if (!key) return

  const activeEl = document.activeElement as HTMLElement | null
  const isInputFocused = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA'
  const isPlayerFocused = activeEl?.id === 'video-player-container'

  let currentEl: HTMLElement | null = null
  if (!activeEl || activeEl === document.body) {
    currentEl = document.querySelector<HTMLElement>('[data-nav-focus]')
    if (!currentEl) {
      if (bootstrapNavFocus()) event?.preventDefault()
      return
    }
  } else {
    currentEl = activeEl
  }

  const currentRect = currentEl.getBoundingClientRect()

  if (isInputFocused) {
    return
  } else if (isPlayerFocused) {
    return
  } else if (key === 'ArrowDown' || key === 'ArrowUp') {
    event?.preventDefault()
  }

  const focusables = Array.from(document.querySelectorAll<HTMLElement>(
    'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), [tabindex="0"]'
  )).filter(el => {
    const style = window.getComputedStyle(el)
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
  })

  let bestMatch: HTMLElement | null = null
  let minDistance = Infinity

  for (const el of focusables) {
    if (el === currentEl) continue
    const rect = el.getBoundingClientRect()
    let dx = 0, dy = 0
    let valid = false
    const overlapX = Math.max(0, Math.min(rect.right, currentRect.right) - Math.max(rect.left, currentRect.left))
    const overlapY = Math.max(0, Math.min(rect.bottom, currentRect.bottom) - Math.max(rect.top, currentRect.top))

    if (key === 'ArrowRight' && (rect.left >= currentRect.right - 10 || (rect.left > currentRect.left && overlapY > 0))) {
      dx = rect.left - currentRect.right
      dy = (rect.top + rect.bottom) / 2 - (currentRect.top + currentRect.bottom) / 2
      valid = true
    } else if (key === 'ArrowLeft' && (rect.right <= currentRect.left + 10 || (rect.right < currentRect.right && overlapY > 0))) {
      dx = currentRect.left - rect.right
      dy = (rect.top + rect.bottom) / 2 - (currentRect.top + currentRect.bottom) / 2
      valid = true
    } else if (key === 'ArrowDown' && (rect.top >= currentRect.bottom - 10 || (rect.top > currentRect.top && overlapX > 0))) {
      dy = rect.top - currentRect.bottom
      dx = (rect.left + rect.right) / 2 - (currentRect.left + currentRect.right) / 2
      valid = true
    } else if (key === 'ArrowUp' && (rect.bottom <= currentRect.top + 10 || (rect.bottom < currentRect.bottom && overlapX > 0))) {
      dy = currentRect.top - rect.bottom
      dx = (rect.left + rect.right) / 2 - (currentRect.left + currentRect.right) / 2
      valid = true
    }

    if (valid) {
      const distance = (key === 'ArrowUp' || key === 'ArrowDown')
        ? dy * dy + dx * dx * 5
        : dx * dx + dy * dy * 5

      if (distance < minDistance) {
        minDistance = distance
        bestMatch = el
      }
    }
  }

  if (bestMatch) {
    event?.preventDefault()
    setNavFocus(bestMatch)
  } else if (isInputFocused) {
    event?.preventDefault()
    forceBootstrapNavFocus()
  }
}
