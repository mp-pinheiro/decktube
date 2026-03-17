import { useEffect, useRef, useCallback, type ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { initGamepad } from '../lib/gamepad'
import { initSpatialNav } from '../lib/spatialNav'
import { bootstrapNavFocus, waitForBootstrap, initNavFocusCleanup } from '../lib/focusManager'
import { InputContext, type ButtonAction } from './InputContext'

interface InputProviderProps {
  children: ReactNode
}

export function InputProvider({ children }: InputProviderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const actionsRef = useRef<Partial<Record<ButtonAction, () => void>>>({})
  const locationKeyRef = useRef(location.key)
  const lastGamepadActionRef = useRef(0)

  useEffect(() => { locationKeyRef.current = location.key }, [location.key])

  const focusSearch = useCallback(() => {
    const searchInput = document.querySelector('input[type="text"]') as HTMLElement
    searchInput?.focus()
  }, [])

  const goBack = useCallback(() => {
    const activeEl = document.activeElement as HTMLElement | null
    const isInputFocused = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA'

    if (isInputFocused) {
      activeEl?.blur()
    } else if (locationKeyRef.current !== 'default') {
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
        if (Date.now() - lastGamepadActionRef.current < 100) return
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
          if (Date.now() - lastGamepadActionRef.current < 100) break
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

    const handleGamepadConnect = () => bootstrapNavFocus()
    window.addEventListener('gamepadconnected', handleGamepadConnect)

    const cleanupNavFocus = initNavFocusCleanup()

    const cleanupGamepad = initGamepad((button, pressed) => {
      if (!pressed) return

      const activeEl = document.activeElement as HTMLElement | null
      const isInputFocused = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA'
      const actions = actionsRef.current

      if ((!activeEl || activeEl === document.body) &&
          ['DPAD_UP', 'DPAD_DOWN', 'DPAD_LEFT', 'DPAD_RIGHT', 'A'].includes(button)) {
        if (bootstrapNavFocus()) {
          if (button !== 'A') return
        }
      }

      if (button === 'A' || button === 'B') {
        lastGamepadActionRef.current = Date.now()
      }

      switch (button) {
        case 'A': {
          const currentEl = document.activeElement as HTMLElement | null
          if (actions.select) {
            actions.select()
          } else {
            currentEl?.click()
          }
          break
        }
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
      window.removeEventListener('gamepadconnected', handleGamepadConnect)
      cleanupNavFocus()
      cleanupGamepad()
      cleanupSpatialNav()
    }
  }, [focusSearch, goBack])

  useEffect(() => {
    return waitForBootstrap()
  }, [location.pathname])

  useEffect(() => {
    const handleFocusBack = () => {
      if (!document.activeElement || document.activeElement === document.body) {
        bootstrapNavFocus()
      }
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') handleFocusBack()
    }

    window.addEventListener('focus', handleFocusBack)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('focus', handleFocusBack)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  return (
    <InputContext.Provider value={{ registerActions, unregisterActions }}>
      {children}
    </InputContext.Provider>
  )
}

export { useInputContext } from './InputContext'
