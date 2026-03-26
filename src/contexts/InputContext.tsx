import { createContext, useContext } from 'react'

export type ButtonAction = 'select' | 'back' | 'channel' | 'search' | 'play' | 'fullscreen' | 'next' | 'quality' | 'prevTab' | 'nextTab' | 'mode' | 'nav_up' | 'nav_down' | 'nav_left' | 'nav_right'

interface InputContextValue {
  registerActions: (actions: Partial<Record<ButtonAction, (isRepeat?: boolean) => void>>) => void
  unregisterActions: () => void
  virtualKeyboardOpen: boolean
  searchText: string
  openVirtualKeyboard: () => void
  closeVirtualKeyboard: () => void
  setSearchText: (text: string) => void
  submitSearch: () => void
}

export const InputContext = createContext<InputContextValue | null>(null)

export function useInputContext() {
  const context = useContext(InputContext)
  if (!context) {
    throw new Error('useInputContext must be used within InputProvider')
  }
  return context
}
