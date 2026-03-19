import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { initGamepad, setAppFocused } from '../lib/gamepad'
import { initSpatialNav } from '../lib/spatialNav'
import { bootstrapNavFocus, forceBootstrapNavFocus, waitForBootstrap, initNavFocusCleanup } from '../lib/focusManager'
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
    const handleKeydown = (e: KeyboardEvent) => {
      if (virtualKeyboardOpenRef.current) return

      const activeEl = document.activeElement as HTMLElement | null
      const isInputFocused = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA'

      if (!isInputFocused && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        openVirtualKeyboard()
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        if (e.repeat) return
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
          if (e.repeat) break
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
        case 'q':
        case 'Q':
          if (actions.quality) {
            e.preventDefault()
            actions.quality()
          }
          break
        case 'Enter': {
          e.preventDefault()
          if (e.repeat) break
          if (Date.now() - lastGamepadActionRef.current < 100) break
          if (activeEl?.id === 'search-display') {
            activeEl.click()
          } else if (actions.select) {
            actions.select()
          } else {
            activeEl?.click()
          }
          break
        }
      }
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
      const actions = actionsRef.current

      if ((!activeEl || activeEl === document.body) &&
          ['DPAD_UP', 'DPAD_DOWN', 'DPAD_LEFT', 'DPAD_RIGHT', 'A'].includes(button)) {
        if (bootstrapNavFocus()) {
          if (button !== 'A') return
        }
      }

      switch (button) {
        case 'A': {
          if (Date.now() - lastGamepadActionRef.current < 300) break
          lastGamepadActionRef.current = Date.now()
          const currentEl = document.activeElement as HTMLElement | null
          if (currentEl?.id === 'search-display') {
            currentEl.click()
          } else if (actions.select) {
            actions.select()
          } else {
            currentEl?.click()
          }
          break
        }
        case 'B':
          if (Date.now() - lastGamepadActionRef.current < 300) break
          lastGamepadActionRef.current = Date.now()
          goBack()
          break
        case 'X':
          if (actions.channel) {
            actions.channel()
          }
          break
        case 'Y':
          openVirtualKeyboard()
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
        case 'LT':
          if (actions.quality) {
            actions.quality()
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
  }, [openVirtualKeyboard, closeVirtualKeyboard, goBack])

  useEffect(() => {
    const api = (window as any).electronAPI
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
