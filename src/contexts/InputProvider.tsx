import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { initGamepad } from '../lib/gamepad'
import { initSpatialNav } from '../lib/spatialNav'
import { InputContext, type ButtonAction, type ButtonConfig } from './InputContext'

interface InputProviderProps {
  children: ReactNode
}

const DEFAULT_BUTTON_CONFIGS: ButtonConfig[] = [
  { key: 'Enter', label: 'Select', visible: true },
  { key: 'Esc', label: 'Back', visible: true },
  { key: 'C', label: 'Channel', visible: false },
  { key: 'S', label: 'Search', visible: true },
  { key: 'Space', label: 'Play', visible: false },
]

export function InputProvider({ children }: InputProviderProps) {
  const navigate = useNavigate()
  const actionsRef = useRef<Partial<Record<ButtonAction, () => void>>>({})
  const [buttonConfigs, setButtonConfigs] = useState<ButtonConfig[]>(DEFAULT_BUTTON_CONFIGS)

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

  const updateButtonConfigs = useCallback((actions: Partial<Record<ButtonAction, () => void>>) => {
    setButtonConfigs(prev => prev.map(config => {
      if (config.label === 'Channel') {
        return { ...config, visible: !!actions.channel }
      }
      if (config.label === 'Play') {
        return { ...config, visible: !!actions.play }
      }
      return config
    }))
  }, [])

  const registerActions = useCallback((actions: Partial<Record<ButtonAction, () => void>>) => {
    actionsRef.current = actions
    updateButtonConfigs(actions)
  }, [updateButtonConfigs])

  const unregisterActions = useCallback(() => {
    actionsRef.current = {}
    updateButtonConfigs({})
  }, [updateButtonConfigs])

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null
      const isInputFocused = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA'

      // Global: S to focus search
      if (!isInputFocused && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        focusSearch()
        return
      }

      // Global: Escape to go back
      if (e.key === 'Escape') {
        goBack()
        return
      }

      // Don't process other shortcuts when typing in input
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
    <InputContext.Provider value={{ registerActions, unregisterActions, buttonConfigs }}>
      {children}
    </InputContext.Provider>
  )
}

export { useInputContext } from './InputContext'
