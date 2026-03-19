import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { initGamepad, setAppFocused } from '../lib/gamepad'
import { handleSpatialNav } from '../lib/spatialNav'
import { bootstrapNavFocus, forceBootstrapNavFocus, waitForBootstrap, initNavFocusCleanup } from '../lib/focusManager'
import { keyToIntent, gamepadToIntent, type InputIntent } from '../lib/inputMap'
import { dispatchThroughLayers } from '../lib/inputLayer'
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

  const [virtualKeyboardOpen, setVirtualKeyboardOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const virtualKeyboardOpenRef = useRef(false)
  const searchTextRef = useRef('')

  useEffect(() => { virtualKeyboardOpenRef.current = virtualKeyboardOpen }, [virtualKeyboardOpen])
  useEffect(() => { searchTextRef.current = searchText }, [searchText])
  useEffect(() => { locationKeyRef.current = location.key }, [location.key])

  const openVirtualKeyboard = useCallback(() => {
    setVirtualKeyboardOpen(true)
  }, [])

  const closeVirtualKeyboard = useCallback(() => {
    setVirtualKeyboardOpen(false)
    forceBootstrapNavFocus()
  }, [])

  const submitSearch = useCallback(() => {
    const text = searchTextRef.current.trim()
    if (text) {
      navigate(`/search?q=${encodeURIComponent(text)}`)
      setVirtualKeyboardOpen(false)
      setSearchText('')
      forceBootstrapNavFocus()
    }
  }, [navigate])

  const goBack = useCallback(() => {
    if (virtualKeyboardOpenRef.current) {
      closeVirtualKeyboard()
      return
    }
    if (locationKeyRef.current !== 'default') {
      navigate(-1)
    }
  }, [navigate, closeVirtualKeyboard])

  const registerActions = useCallback((actions: Partial<Record<ButtonAction, () => void>>) => {
    actionsRef.current = actions
  }, [])

  const unregisterActions = useCallback(() => {
    actionsRef.current = {}
  }, [])

  useEffect(() => {
    const handleIntent = (intent: InputIntent, source: 'keyboard' | 'gamepad', event?: KeyboardEvent): boolean => {
      if (dispatchThroughLayers(intent, event)) return true

      const activeEl = document.activeElement as HTMLElement | null
      const isInputFocused = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA'

      if (isInputFocused && intent !== 'back' && intent !== 'help') return false

      const actions = actionsRef.current

      if (source === 'gamepad' && (intent === 'select' || intent === 'back')) {
        if (Date.now() - lastGamepadActionRef.current < 300) return true
        lastGamepadActionRef.current = Date.now()
      }

      if (source === 'keyboard' && (intent === 'select' || intent === 'back')) {
        if (Date.now() - lastGamepadActionRef.current < 100) return true
      }

      switch (intent) {
        case 'select': {
          event?.preventDefault()
          if (event?.repeat) return true
          if (activeEl?.id === 'search-display') {
            activeEl.click()
          } else if (actions.select && activeEl?.closest('[data-video-id]')) {
            actions.select()
          } else if (actions.play && activeEl && !['A', 'BUTTON', 'INPUT', 'TEXTAREA'].includes(activeEl.tagName)) {
            actions.play()
          } else {
            activeEl?.click()
          }
          return true
        }
        case 'back':
          event?.preventDefault()
          if (event?.repeat) return true
          goBack()
          return true
        case 'search':
          event?.preventDefault()
          openVirtualKeyboard()
          return true
        case 'channel':
          if (actions.channel) {
            event?.preventDefault()
            actions.channel()
          }
          return true
        case 'play':
          if (event?.repeat) return true
          if (actions.play) {
            event?.preventDefault()
            actions.play()
          }
          return true
        case 'fullscreen':
          if (actions.fullscreen) {
            event?.preventDefault()
            actions.fullscreen()
          } else if (source === 'gamepad' && actions.prevTab) {
            actions.prevTab()
          }
          return true
        case 'quality':
          if (actions.quality) {
            event?.preventDefault()
            actions.quality()
          }
          return true
        case 'next':
          if (actions.next) {
            event?.preventDefault()
            actions.next()
          }
          return true
        case 'prevTab':
          if (actions.prevTab) {
            event?.preventDefault()
            actions.prevTab()
          }
          return true
        case 'nextTab':
          if (actions.nextTab) {
            event?.preventDefault()
            actions.nextTab()
          }
          return true
        case 'mode':
          if (actions.mode) {
            event?.preventDefault()
            actions.mode()
          }
          return true
        case 'help':
          // Handled by help-toggle layer
          return false
        case 'nav_up':
        case 'nav_down':
        case 'nav_left':
        case 'nav_right':
          if (actions[intent]) {
            event?.preventDefault()
            actions[intent]!()
            return true
          }
          handleSpatialNav(intent, event)
          return true
      }
    }

    const handleKeydown = (e: KeyboardEvent) => {
      if (virtualKeyboardOpenRef.current) return

      const intent = keyToIntent(e.key)
      if (!intent) return

      handleIntent(intent, 'keyboard', e)
    }

    window.addEventListener('keydown', handleKeydown)

    const handleGamepadConnect = () => bootstrapNavFocus()
    window.addEventListener('gamepadconnected', handleGamepadConnect)

    const cleanupNavFocus = initNavFocusCleanup()

    const cleanupGamepad = initGamepad((button, pressed) => {
      if (!pressed) return

      if (virtualKeyboardOpenRef.current) {
        switch (button) {
          case 'A':
            window.dispatchEvent(new CustomEvent('vk-press'))
            break
          case 'B':
            closeVirtualKeyboard()
            break
          case 'X':
            window.dispatchEvent(new CustomEvent('vk-backspace'))
            break
          case 'Y':
            window.dispatchEvent(new CustomEvent('vk-space'))
            break
          case 'START':
            window.dispatchEvent(new CustomEvent('vk-submit'))
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
        return
      }

      const activeEl = document.activeElement as HTMLElement | null

      if ((!activeEl || activeEl === document.body) &&
          ['DPAD_UP', 'DPAD_DOWN', 'DPAD_LEFT', 'DPAD_RIGHT', 'A'].includes(button)) {
        if (bootstrapNavFocus()) {
          if (button !== 'A') return
        }
      }

      const intent = gamepadToIntent(button)
      if (intent) handleIntent(intent, 'gamepad')
    })

    return () => {
      window.removeEventListener('keydown', handleKeydown)
      window.removeEventListener('gamepadconnected', handleGamepadConnect)
      cleanupNavFocus()
      cleanupGamepad()
    }
  }, [openVirtualKeyboard, closeVirtualKeyboard, goBack])

  useEffect(() => {
    const api = window.electronAPI
    if (!api?.onWindowFocusChange) return
    return api.onWindowFocusChange((focused: boolean) => {
      setAppFocused(focused)
    })
  }, [])

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
    <InputContext.Provider value={{
      registerActions,
      unregisterActions,
      virtualKeyboardOpen,
      searchText,
      openVirtualKeyboard,
      closeVirtualKeyboard,
      setSearchText,
      submitSearch,
    }}>
      {children}
    </InputContext.Provider>
  )
}

export { useInputContext } from './InputContext'
