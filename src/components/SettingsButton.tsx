import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Settings } from 'lucide-react'
import { pushInputLayer } from '../lib/inputLayer'
import { isAuthenticated, logout } from '../lib/oauth'
import { routes } from '../routePaths'

const SHORTCUTS = [
  { action: 'Select / Play', keyboard: 'Enter / Space', gamepad: 'A' },
  { action: 'Back', keyboard: 'Esc', gamepad: 'B' },
  { action: 'Channel', keyboard: 'C', gamepad: 'X' },
  { action: 'Search', keyboard: 'S', gamepad: 'Y' },
  { action: 'Fullscreen', keyboard: 'F', gamepad: 'LB' },
  { action: 'Quality', keyboard: 'Q', gamepad: 'LT' },
  { action: 'Mode Menu', keyboard: 'M', gamepad: 'Start' },
  { action: 'Switch Tab', keyboard: '[ / ]', gamepad: 'LB / RB' },
  { action: 'Navigate', keyboard: 'Arrows', gamepad: 'D-Pad' },
  { action: 'Help / Settings', keyboard: 'H', gamepad: 'Select' },
  { action: 'Lock input', keyboard: 'Hold -', gamepad: 'Hold LB + RB' },
]

export default function SettingsButton() {
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const focusIndexRef = useRef(0)

  const focusItem = useCallback((index: number) => {
    const items = listRef.current?.querySelectorAll<HTMLButtonElement | HTMLAnchorElement>('[data-settings-item]')
    if (!items?.length) return
    const clamped = Math.max(0, Math.min(index, items.length - 1))
    focusIndexRef.current = clamped
    items[clamped].focus()
  }, [])

  useEffect(() => {
    return pushInputLayer('settings-toggle', (intent) => {
      if (intent !== 'help') return false
      const activeEl = document.activeElement as HTMLElement | null
      const isInputFocused = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA'
      if (isInputFocused) return false
      setOpen(prev => !prev)
      return true
    })
  }, [])

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => focusItem(0))
  }, [open, focusItem])

  useEffect(() => {
    if (!open) return
    return pushInputLayer('settings-modal', (intent) => {
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
          const el = document.activeElement as (HTMLButtonElement | HTMLAnchorElement) | null
          if (el && listRef.current?.contains(el)) el.click()
          return true
        }
        case 'back':
        case 'help':
          setOpen(false)
          return true
        default:
          return true
      }
    })
  }, [open, focusItem])

  const handleLogout = () => {
    logout()
    window.location.href = routes.home
  }

  const handleExit = () => {
    window.electronAPI?.exitApp()
  }

  const authenticated = isAuthenticated()

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Settings"
        className="w-10 h-10 flex items-center justify-center bg-zinc-900 hover:bg-zinc-800 border border-white/10 rounded-full text-zinc-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
      >
        <Settings size={18} />
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            ref={listRef}
            onClick={e => e.stopPropagation()}
            className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-[880px] max-w-[95vw] max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            <h2 className="text-lg font-bold text-white mb-5">Settings</h2>

            <div className="flex gap-6 items-start">
              <section className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-zinc-300 mb-2">Controls</h3>
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
              </section>

              <div className="flex-1 min-w-0">
                <section>
                  <h3 className="text-sm font-semibold text-zinc-300 mb-2">Account</h3>
                  <div className="space-y-2">
                    {authenticated ? (
                      <button
                        data-settings-item
                        onClick={handleLogout}
                        className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-white/10 rounded-xl text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        Sign out
                      </button>
                    ) : (
                      <Link
                        data-settings-item
                        to={routes.login}
                        onClick={() => setOpen(false)}
                        className="block w-full py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-bold text-white text-center transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        Sign in
                      </Link>
                    )}
                    <button
                      data-settings-item
                      onClick={handleExit}
                      className="w-full py-2.5 bg-zinc-800 hover:bg-red-900/40 border border-white/10 hover:border-red-700/50 rounded-xl text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      Exit App
                    </button>
                  </div>
                </section>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-white/5 text-center">
              <span className="text-[10px] text-zinc-600 font-mono">v{__APP_VERSION__}</span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
