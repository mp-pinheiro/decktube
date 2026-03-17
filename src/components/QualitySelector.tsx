import { useEffect, useRef, useCallback } from 'react'

export interface QualityOption {
  label: string
  value: string
}

interface QualitySelectorProps {
  open: boolean
  onClose: () => void
  qualities: QualityOption[]
  currentQuality: string
  onSelectQuality: (value: string) => void
}

export default function QualitySelector({
  open,
  onClose,
  qualities,
  currentQuality,
  onSelectQuality,
}: QualitySelectorProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const focusIndexRef = useRef(0)

  const focusItem = useCallback((index: number) => {
    const items = listRef.current?.querySelectorAll<HTMLButtonElement>('[data-quality]')
    if (!items?.length) return
    const clamped = Math.max(0, Math.min(index, items.length - 1))
    focusIndexRef.current = clamped
    items[clamped].focus()
  }, [])

  useEffect(() => {
    if (!open) return

    requestAnimationFrame(() => {
      const activeIdx = qualities.findIndex(q => q.value === currentQuality)
      focusItem(activeIdx >= 0 ? activeIdx : 0)
    })
  }, [open, qualities, currentQuality, focusItem])

  useEffect(() => {
    if (!open) return

    const handleKeydown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          e.stopPropagation()
          focusItem(focusIndexRef.current - 1)
          break
        case 'ArrowDown':
          e.preventDefault()
          e.stopPropagation()
          focusItem(focusIndexRef.current + 1)
          break
        case 'ArrowLeft':
        case 'ArrowRight':
          e.preventDefault()
          e.stopPropagation()
          break
        case 'Enter':
        case ' ': {
          e.preventDefault()
          e.stopPropagation()
          const focused = document.activeElement as HTMLButtonElement | null
          const quality = focused?.getAttribute('data-quality')
          if (quality) {
            onSelectQuality(quality)
            onClose()
          }
          break
        }
        case 'Escape':
        case 'q':
        case 'Q':
          e.preventDefault()
          e.stopPropagation()
          onClose()
          break
      }
    }

    window.addEventListener('keydown', handleKeydown, true)
    return () => window.removeEventListener('keydown', handleKeydown, true)
  }, [open, onClose, onSelectQuality, focusItem])

  if (!open || !qualities.length) return null

  return (
    <div className="absolute bottom-4 right-4 z-30 bg-zinc-900/95 backdrop-blur-md border border-white/10 rounded-xl p-2 min-w-[140px] shadow-2xl">
      <div ref={listRef} className="flex flex-col gap-0.5">
        {qualities.map((q) => {
          const isActive = q.value === currentQuality
          return (
            <button
              key={q.value}
              data-quality={q.value}
              onClick={() => {
                onSelectQuality(q.value)
                onClose()
              }}
              className={`px-3 py-1.5 text-sm text-left rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 ${
                isActive
                  ? 'text-red-500 font-bold bg-white/5'
                  : 'text-zinc-300 hover:bg-white/5'
              }`}
            >
              {q.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
