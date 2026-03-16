import { useEffect, useRef, useCallback, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { initGamepad } from '../lib/gamepad'
import { initSpatialNav } from '../lib/spatialNav'
import { InputContext, type ButtonAction } from './InputContext'

interface InputProviderProps {
  children: ReactNode
}

export function InputProvider({ children }: InputProviderProps) {
  const navigate = useNavigate()
  const actionsRef = useRef<Partial<Record<ButtonAction, () => void>>>({})

  const focusSearch = useCallback(() => {
    const searchInput = document.querySelector('input[type="text"]') as HTMLElement
    searchInput?.focus()
  }, [])

  const goBack = useCallback(() => {
    const activeEl = document.activeElement as HTMLElement | null
    const isInputFocused = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA'

    if (isInputFocused) {
      activeEl?.blur()
    } else {
      navigate(-1)
    }
  }, [navigate])

  const registerActions = useCallback((actions: Partial<Record<ButtonAction, () => void>>) => {
    actionsRef.current = actions
  }, [])

  const unregisterActions = useCallback(() => {
    actionsRef.current = {}
  }, [])

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null
      const isInputFocused = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA'

      if (!isInputFocused && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        focusSearch()
        return
      }

      if (e.key === 'Escape') {
        goBack()
        return
      }

      if (isInputFocused) return

      const actions = actionsRef.current

      switch (e.key) {
        case 'c':
        case 'C':
          if (actions.channel) {
            e.preventDefault()
            actions.channel()
          }
          break
        case ' ':
          if (actions.play) {
            e.preventDefault()
            actions.play()
          }
          break
        case 'f':
        case 'F':
          if (actions.fullscreen) {
            e.preventDefault()
            actions.fullscreen()
          }
          break
        case 'n':
        case 'N':
          if (actions.next) {
            e.preventDefault()
            actions.next()
          }
          break
        case 'Enter':
          if (actions.select) {
            e.preventDefault()
            actions.select()
          } else {
            activeEl?.click()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeydown)

    const cleanupGamepad = initGamepad((button, pressed) => {
      if (!pressed) return

      const activeEl = document.activeElement as HTMLElement | null
      const isInputFocused = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA'
      const actions = actionsRef.current

      if ((!activeEl || activeEl === document.body) &&
          ['DPAD_UP', 'DPAD_DOWN', 'DPAD_LEFT', 'DPAD_RIGHT', 'A'].includes(button)) {
        const bootstrapTarget = document.querySelector<HTMLElement>(
          '[data-video-id], #video-player-container, main button:not([disabled]), main a[href]:not([tabindex="-1"])'
        )
        if (bootstrapTarget) {
          bootstrapTarget.focus()
          bootstrapTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          return
        }
      }

      switch (button) {
        case 'A':
          if (actions.select) {
            actions.select()
          } else {
            activeEl?.click()
          }
          break
        case 'B':
          goBack()
          break
        case 'X':
          if (actions.channel) {
            actions.channel()
          }
          break
        case 'Y':
          if (!isInputFocused) {
            focusSearch()
          }
          break
        case 'RB':
          if (actions.play) {
            actions.play()
          }
          break
        case 'LB':
          if (actions.fullscreen) {
            actions.fullscreen()
          }
          break
        case 'SELECT':
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }))
          break
        case 'DPAD_UP':
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }))
          break
        case 'DPAD_DOWN':
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
          break
        case 'DPAD_LEFT':
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
          break
        case 'DPAD_RIGHT':
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
          break
      }
    })

    const cleanupSpatialNav = initSpatialNav()

    return () => {
      window.removeEventListener('keydown', handleKeydown)
      cleanupGamepad()
      cleanupSpatialNav()
    }
  }, [focusSearch, goBack])

  return (
    <InputContext.Provider value={{ registerActions, unregisterActions }}>
      {children}
    </InputContext.Provider>
  )
}

export { useInputContext } from './InputContext'
