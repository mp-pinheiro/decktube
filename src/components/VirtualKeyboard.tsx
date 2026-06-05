import { useEffect, useRef, useState, useCallback } from 'react'
import Keyboard from 'react-simple-keyboard'
import { useInputContext } from '../contexts/InputContext'

const LAYOUT = {
  default: [
    '1 2 3 4 5 6 7 8 9 0',
    'q w e r t y u i o p',
    'a s d f g h j k l',
    'z x c v b n m . - _',
    '{bksp} {space} {enter}',
  ],
}

const DISPLAY: Record<string, string> = {
  '{space}': 'SPACE',
  '{bksp}': 'DELETE',
  '{enter}': 'SEARCH',
}

const GRID = LAYOUT.default.map(row => row.split(' '))
const START = { row: 1, col: 0 }
const ratioOf = (row: number, col: number) => (GRID[row].length > 1 ? col / (GRID[row].length - 1) : 0)

export default function VirtualKeyboard() {
  const {
    virtualKeyboardOpen,
    searchText,
    setSearchText,
    submitSearch,
    closeVirtualKeyboard,
  } = useInputContext()

  const searchTextRef = useRef(searchText)
  useEffect(() => { searchTextRef.current = searchText }, [searchText])

  const posRef = useRef({ ...START })
  // Anchor column (0..1) preserved across vertical moves so traversing rows of different widths stays
  // aligned (b → down to SPACE → down lands on the key above b). Updated only on horizontal moves.
  const anchorRef = useRef(ratioOf(START.row, START.col))
  const [activeButton, setActiveButton] = useState(GRID[START.row][START.col])

  const moveTo = useCallback((row: number, col: number) => {
    const r = Math.max(0, Math.min(row, GRID.length - 1))
    const c = Math.max(0, Math.min(col, GRID[r].length - 1))
    posRef.current = { row: r, col: c }
    setActiveButton(GRID[r][c])
  }, [])

  // Horizontal wraps around row edges and re-anchors the column.
  const stepHorizontal = useCallback((dir: -1 | 1) => {
    const { row } = posRef.current
    const len = GRID[row].length
    const col = (posRef.current.col + dir + len) % len
    anchorRef.current = ratioOf(row, col)
    moveTo(row, col)
  }, [moveTo])

  // Vertical wraps top/bottom and lands on the anchored column in the next row.
  const stepVertical = useCallback((dir: -1 | 1) => {
    const next = (posRef.current.row + dir + GRID.length) % GRID.length
    moveTo(next, Math.round(anchorRef.current * (GRID[next].length - 1)))
  }, [moveTo])

  // Reset to a known key each time the keyboard opens (deferred a frame to avoid a sync effect render).
  useEffect(() => {
    if (!virtualKeyboardOpen) return
    const id = requestAnimationFrame(() => {
      anchorRef.current = ratioOf(START.row, START.col)
      moveTo(START.row, START.col)
    })
    return () => cancelAnimationFrame(id)
  }, [virtualKeyboardOpen, moveTo])

  const syncInput = useCallback((text: string) => {
    searchTextRef.current = text
    setSearchText(text)
  }, [setSearchText])

  const pressButton = useCallback((button: string) => {
    if (button === '{enter}') submitSearch()
    else if (button === '{bksp}') syncInput(searchTextRef.current.slice(0, -1))
    else if (button === '{space}') syncInput(searchTextRef.current + ' ')
    else syncInput(searchTextRef.current + button)
  }, [submitSearch, syncInput])

  const pressActive = useCallback(() => {
    const { row, col } = posRef.current
    pressButton(GRID[row][col])
  }, [pressButton])

  // One move per keydown — the held-direction cadence is the gamepad/OS key repeat, kept snappy.
  useEffect(() => {
    if (!virtualKeyboardOpen) return

    const handleKeydown = (e: KeyboardEvent) => {
      e.stopPropagation()
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          stepVertical(-1)
          break
        case 'ArrowDown':
          e.preventDefault()
          stepVertical(1)
          break
        case 'ArrowLeft':
          e.preventDefault()
          stepHorizontal(-1)
          break
        case 'ArrowRight':
          e.preventDefault()
          stepHorizontal(1)
          break
        case 'Enter':
          e.preventDefault()
          pressActive()
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
  }, [virtualKeyboardOpen, stepVertical, stepHorizontal, pressActive, closeVirtualKeyboard, syncInput])

  useEffect(() => {
    if (!virtualKeyboardOpen) return

    const handlePress = () => pressActive()
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
  }, [virtualKeyboardOpen, pressActive, syncInput, submitSearch])

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
          layout={LAYOUT}
          display={DISPLAY}
          onKeyPress={pressButton}
          theme="simple-keyboard hg-theme-default vk-dark"
          buttonTheme={[{ class: 'hg-keyMarker', buttons: activeButton }]}
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
