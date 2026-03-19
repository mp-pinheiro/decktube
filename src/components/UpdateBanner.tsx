import { useState, useEffect, useCallback, useRef } from 'react'
import { pushInputLayer } from '../lib/inputLayer'

type BannerState =
  | { phase: 'hidden' }
  | { phase: 'available'; version: string }
  | { phase: 'downloading'; percent: number }
  | { phase: 'downloaded'; version: string }

export default function UpdateBanner() {
  const [state, setState] = useState<BannerState>({ phase: 'hidden' })
  const modalRef = useRef<HTMLDivElement>(null)
  const primaryBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const api = window.electronAPI
    if (!api?.onUpdateStatus) return

    return api.onUpdateStatus((payload) => {
      switch (payload.status) {
        case 'available':
          setState({ phase: 'available', version: payload.version ?? '' })
          break
        case 'downloading':
          setState({ phase: 'downloading', percent: payload.percent ?? 0 })
          break
        case 'downloaded':
          setState((prev) => ({
            phase: 'downloaded',
            version: payload.version ?? (prev.phase === 'available' ? prev.version : ''),
          }))
          break
        case 'not-available':
          setState({ phase: 'hidden' })
          break
        case 'error':
          console.error('[UpdateBanner] Update error:', payload.message)
          break
      }
    })
  }, [])

  useEffect(() => {
    if (state.phase === 'hidden') return
    return pushInputLayer('update-modal', (intent, event) => {
      if (intent === 'back') {
        if (state.phase === 'downloading') return true
        setState({ phase: 'hidden' })
        return true
      }
      if (intent === 'select') {
        const active = document.activeElement as HTMLElement | null
        active?.click()
        return true
      }
      if (intent === 'nav_left' || intent === 'nav_right' || intent === 'nav_up' || intent === 'nav_down') {
        event?.preventDefault()
        const buttons = modalRef.current?.querySelectorAll<HTMLElement>('button')
        if (!buttons || buttons.length <= 1) return true
        const active = document.activeElement as HTMLElement
        const idx = Array.from(buttons).indexOf(active as HTMLButtonElement)
        if (idx === -1) {
          buttons[0].focus()
        } else if (intent === 'nav_right' || intent === 'nav_down') {
          buttons[(idx + 1) % buttons.length].focus()
        } else {
          buttons[(idx - 1 + buttons.length) % buttons.length].focus()
        }
        return true
      }
      return true
    })
  }, [state.phase])

  useEffect(() => {
    if (state.phase === 'available' || state.phase === 'downloaded') {
      requestAnimationFrame(() => primaryBtnRef.current?.focus())
    }
  }, [state.phase])

  const handleDownload = useCallback(() => {
    window.electronAPI?.downloadUpdate()
    setState({ phase: 'downloading', percent: 0 })
  }, [])

  const handleInstall = useCallback(() => {
    window.electronAPI?.installUpdate()
  }, [])

  const handleDismiss = useCallback(() => {
    setState({ phase: 'hidden' })
  }, [])

  if (state.phase === 'hidden') return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleDismiss}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-[380px] max-w-[90vw] shadow-2xl focus:outline-none"
      >
        {state.phase === 'available' && (
          <>
            <div className="flex items-center gap-3 mb-3">
              <svg className="w-6 h-6 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l-4-4m4 4l4-4" />
              </svg>
              <h2 className="text-lg font-bold text-white">Update Available</h2>
            </div>
            <p className="text-sm text-zinc-400 mb-5">
              Version <span className="font-semibold text-white">{state.version}</span> is ready to download.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDismiss}
                className="flex-1 px-4 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Cancel
              </button>
              <button
                ref={primaryBtnRef}
                onClick={handleDownload}
                className="flex-1 px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Download
              </button>
            </div>
          </>
        )}

        {state.phase === 'downloading' && (
          <>
            <div className="flex items-center gap-3 mb-3">
              <svg className="w-6 h-6 text-blue-400 shrink-0 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l-4-4m4 4l4-4" />
              </svg>
              <h2 className="text-lg font-bold text-white">Downloading Update</h2>
            </div>
            <p className="text-sm text-zinc-400 mb-4">Please wait while the update is downloaded...</p>
            <div className="h-2 bg-zinc-700 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-red-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.round(state.percent)}%` }}
              />
            </div>
            <p className="text-xs text-zinc-500 text-right tabular-nums">{Math.round(state.percent)}%</p>
          </>
        )}

        {state.phase === 'downloaded' && (
          <>
            <div className="flex items-center gap-3 mb-3">
              <svg className="w-6 h-6 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <h2 className="text-lg font-bold text-white">Update Ready</h2>
            </div>
            <p className="text-sm text-zinc-400 mb-5">
              Version <span className="font-semibold text-white">{state.version}</span> has been downloaded. Restart to apply.
            </p>
            <button
              ref={primaryBtnRef}
              onClick={handleInstall}
              className="w-full px-4 py-2 text-sm font-medium bg-green-600 hover:bg-green-500 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Restart
            </button>
          </>
        )}
      </div>
    </div>
  )
}
