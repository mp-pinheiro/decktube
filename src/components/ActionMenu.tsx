import { useEffect, useRef, useCallback } from 'react'
import { pushInputLayer } from '../lib/inputLayer'

export interface ActionMenuItem {
  id: string
  label: string
  danger?: boolean
}

interface ActionMenuProps {
  open: boolean
  onClose: () => void
  items: ActionMenuItem[]
  onSelect: (id: string) => void
}

export default function ActionMenu({ open, onClose, items, onSelect }: ActionMenuProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const focusIndexRef = useRef(0)

  const focusItem = useCallback((index: number) => {
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[data-action-id]')
    if (!buttons?.length) return
    const clamped = Math.max(0, Math.min(index, buttons.length - 1))
    focusIndexRef.current = clamped
    buttons[clamped].focus()
  }, [])

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => focusItem(0))
  }, [open, focusItem])

  useEffect(() => {
    if (!open) return

    return pushInputLayer('action-menu', (intent) => {
      switch (intent) {
        case 'nav_up':
          focusItem(focusIndexRef.current - 1)
          return true
        case 'nav_down':
          focusItem(focusIndexRef.current + 1)
          return true
        case 'nav_left':
        case 'nav_right':
          return true
        case 'select': {
          const focused = document.activeElement as HTMLButtonElement | null
          const actionId = focused?.getAttribute('data-action-id')
          if (actionId) onSelect(actionId)
          return true
        }
        case 'back':
        case 'mode':
          onClose()
          return true
        default:
          return true
      }
    })
  }, [open, onClose, onSelect, focusItem])

  if (!open || !items.length) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="bg-zinc-900 border border-white/10 rounded-2xl p-2 min-w-[220px] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div ref={listRef} className="flex flex-col gap-0.5">
          {items.map((item) => (
            <button
              key={item.id}
              data-action-id={item.id}
              onClick={() => onSelect(item.id)}
              className={`px-4 py-2.5 text-sm text-left rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 ${
                item.danger
                  ? 'text-red-400 hover:bg-red-500/10'
                  : 'text-zinc-300 hover:bg-white/5'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
