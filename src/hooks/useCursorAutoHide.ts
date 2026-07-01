import { useEffect } from 'react'

const IDLE_MS = 3000

export function useCursorAutoHide(idleMs = IDLE_MS) {
  useEffect(() => {
    const root = document.documentElement
    let timer: ReturnType<typeof setTimeout> | null = null
    let hidden = false

    const hide = () => {
      hidden = true
      root.classList.add('cursor-hidden')
    }
    const show = () => {
      if (hidden) {
        hidden = false
        root.classList.remove('cursor-hidden')
      }
      if (timer) clearTimeout(timer)
      timer = setTimeout(hide, idleMs)
    }

    hide()
    window.addEventListener('mousemove', show)
    window.addEventListener('mousedown', show)

    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener('mousemove', show)
      window.removeEventListener('mousedown', show)
      root.classList.remove('cursor-hidden')
    }
  }, [idleMs])
}
