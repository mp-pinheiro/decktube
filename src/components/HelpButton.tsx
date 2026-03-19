import { useState, useEffect, useRef } from 'react'

const SHORTCUTS = [
  { action: 'Select', keyboard: 'Enter', gamepad: 'A' },
  { action: 'Back', keyboard: 'Esc', gamepad: 'B' },
  { action: 'Channel', keyboard: 'C', gamepad: 'X' },
  { action: 'Search', keyboard: 'S', gamepad: 'Y' },
  { action: 'Play / Pause', keyboard: 'Space', gamepad: 'RB' },
  { action: 'Fullscreen', keyboard: 'F', gamepad: 'LB' },
  { action: 'Quality', keyboard: 'Q', gamepad: 'LT' },
  { action: 'Switch Tab', keyboard: '[ / ]', gamepad: 'LB / RB' },
  { action: 'Navigate', keyboard: 'Arrows', gamepad: 'D-Pad' },
  { action: 'Help', keyboard: 'H', gamepad: 'Select' },
]

export default function HelpButton({ inline = false }: { inline?: boolean }) {
  const [open, setOpen] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null
      const isInputFocused = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA'

      if (e.key === 'h' || e.key === 'H') {
        if (isInputFocused) return
        e.preventDefault()
        e.stopPropagation()
        setOpen(prev => !prev)
        return
      }

      if (open && e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
      }
    }

    window.addEventListener('keydown', handleKey, true)
    return () => window.removeEventListener('keydown', handleKey, true)
  }, [open])

  useEffect(() => {
    if (open) {
      modalRef.current?.focus()
    }
  }, [open])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`w-9 h-9 flex items-center justify-center bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-full text-zinc-400 text-sm font-bold hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500${inline ? '' : ' fixed bottom-6 right-6 z-40'}`}
      >
        ?
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            ref={modalRef}
            tabIndex={-1}
            onClick={e => e.stopPropagation()}
            className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-[420px] max-w-[90vw] shadow-2xl focus:outline-none"
          >
            <h2 className="text-lg font-bold text-white mb-4">Controls</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 text-left">
                  <th className="pb-2 font-medium">Action</th>
                  <th className="pb-2 font-medium">Keyboard</th>
                  <th className="pb-2 font-medium">Gamepad</th>
                </tr>
              </thead>
              <tbody>
                {SHORTCUTS.map(s => (
                  <tr key={s.action} className="border-t border-white/5">
                    <td className="py-2 text-zinc-300">{s.action}</td>
                    <td className="py-2">
                      <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs font-mono text-zinc-300">
                        {s.keyboard}
                      </kbd>
                    </td>
                    <td className="py-2">
                      <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs font-mono text-zinc-300">
                        {s.gamepad}
                      </kbd>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
