import { createContext, useContext } from 'react'

export type ButtonAction = 'select' | 'back' | 'channel' | 'search' | 'play' | 'fullscreen' | 'next' | 'quality'

interface InputContextValue {
  registerActions: (actions: Partial<Record<ButtonAction, () => void>>) => void
  unregisterActions: () => void
}

export const InputContext = createContext<InputContextValue | null>(null)

export function useInputContext() {
  const context = useContext(InputContext)
  if (!context) {
    throw new Error('useInputContext must be used within InputProvider')
  }
  return context
}
