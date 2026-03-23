import { useEffect, useRef, useCallback } from 'react'
import Keyboard from 'react-simple-keyboard'
import keyNavigation from 'simple-keyboard-key-navigation'
import { useInputContext } from '../contexts/InputContext'
import type { SimpleKeyboard } from 'react-simple-keyboard'

const LAYOUT = {
  default: [
    '1 2 3 4 5 6 7 8 9 0',
    'q w e r t y u i o p',
    'a s d f g h j k l',
    'z x c v b n m . - _',
    '{space} {bksp} {enter}',
  ],
}

const DISPLAY: Record<string, string> = {
  '{space}': 'SPACE',
  '{bksp}': 'DELETE',
  '{enter}': 'SEARCH',
}

export default function VirtualKeyboard() {
  const {
    virtualKeyboardOpen,
    searchText,
    setSearchText,
    submitSearch,
    closeVirtualKeyboard,
  } = useInputContext()

  const keyboardRef = useRef<SimpleKeyboard | null>(null)
  const searchTextRef = useRef(searchText)
  searchTextRef.current = searchText

  const syncInput = useCallback((text: string) => {
    setSearchText(text)
    keyboardRef.current?.setInput(text)
  }, [setSearchText])

  useEffect(() => {
    if (!virtualKeyboardOpen) return

    const handleKeydown = (e: KeyboardEvent) => {
      const nav = keyboardRef.current?.modules?.keyNavigation
      if (!nav) return

      e.stopPropagation()

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          nav.up()
          break
        case 'ArrowDown':
          e.preventDefault()
          nav.down()
          break
        case 'ArrowLeft':
          e.preventDefault()
          nav.left()
          break
        case 'ArrowRight':
          e.preventDefault()
          nav.right()
          break
        case 'Enter':
          e.preventDefault()
          nav.press()
          break
        case 'Escape':
          e.preventDefault()
          closeVirtualKeyboard()
          break
        case 'Backspace':
          e.preventDefault()
          syncInput(searchTextRef.current.slice(0, -1))
          break
        default:
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault()
            syncInput(searchTextRef.current + e.key)
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeydown, true)
    return () => window.removeEventListener('keydown', handleKeydown, true)
  }, [virtualKeyboardOpen, closeVirtualKeyboard, syncInput])

  useEffect(() => {
    if (!virtualKeyboardOpen) return

    const handlePress = () => keyboardRef.current?.modules?.keyNavigation?.press()
    const handleBackspace = () => syncInput(searchTextRef.current.slice(0, -1))
    const handleSpace = () => syncInput(searchTextRef.current + ' ')
    const handleSubmit = () => submitSearch()

    window.addEventListener('vk-press', handlePress)
    window.addEventListener('vk-backspace', handleBackspace)
    window.addEventListener('vk-space', handleSpace)
    window.addEventListener('vk-submit', handleSubmit)

    return () => {
      window.removeEventListener('vk-press', handlePress)
      window.removeEventListener('vk-backspace', handleBackspace)
      window.removeEventListener('vk-space', handleSpace)
      window.removeEventListener('vk-submit', handleSubmit)
    }
  }, [virtualKeyboardOpen, syncInput, submitSearch])

  const handleChange = useCallback((input: string) => {
    setSearchText(input)
  }, [setSearchText])

  const handleKeyPress = useCallback((button: string) => {
    if (button === '{enter}') {
      submitSearch()
    }
  }, [submitSearch])

  if (!virtualKeyboardOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-end pb-4">
      <div className="w-[92%] flex flex-col gap-2">
        <div className="w-full h-14 bg-zinc-900 border border-white/10 rounded-xl px-5 flex items-center">
          {searchText ? (
            <span className="text-zinc-100 text-xl truncate">{searchText}</span>
          ) : (
            <span className="text-zinc-500 text-xl">Search videos...</span>
          )}
          <span className="text-zinc-100 text-xl ml-0.5">|</span>
        </div>

        <Keyboard
          keyboardRef={(r: SimpleKeyboard) => { keyboardRef.current = r }}
          layout={LAYOUT}
          display={DISPLAY}
          onChange={handleChange}
          onKeyPress={handleKeyPress}
          theme="simple-keyboard hg-theme-default vk-dark"
          modules={[keyNavigation]}
          enableKeyNavigation
          disableCaretPositioning
        />

        <div className="flex items-center justify-center gap-6 text-sm text-zinc-500">
          <span><kbd className="text-zinc-300">A</kbd> Type</span>
          <span><kbd className="text-zinc-300">B</kbd> Close</span>
          <span><kbd className="text-zinc-300">X</kbd> Delete</span>
          <span><kbd className="text-zinc-300">Y</kbd> Space</span>
          <span><kbd className="text-zinc-300">Start</kbd> Search</span>
        </div>
      </div>
    </div>
  )
}
