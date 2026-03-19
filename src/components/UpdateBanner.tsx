import { useState, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'

type BannerState =
  | { phase: 'hidden' }
  | { phase: 'available'; version: string }
  | { phase: 'downloading'; percent: number }
  | { phase: 'downloaded'; version: string }

export default function UpdateBanner() {
  const [state, setState] = useState<BannerState>({ phase: 'hidden' })
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout>>()

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
        case 'error':
          setState({ phase: 'hidden' })
          break
      }
    })
  }, [])

  useEffect(() => {
    clearTimeout(dismissTimerRef.current)
    if (state.phase === 'available') {
      dismissTimerRef.current = setTimeout(() => setState({ phase: 'hidden' }), 15_000)
    }
    return () => clearTimeout(dismissTimerRef.current)
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

  const visible = state.phase !== 'hidden'

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-6 left-6 z-40 flex items-center gap-3 bg-zinc-900/95 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 shadow-2xl"
        >
          {state.phase === 'available' && (
            <>
              <svg className="w-5 h-5 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l-4-4m4 4l4-4" />
              </svg>
              <span className="text-sm text-zinc-200">
                Update <span className="font-semibold text-white">{state.version}</span> available
              </span>
              <button
                tabIndex={0}
                onClick={handleDownload}
                className="ml-1 px-3 py-1 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Download
              </button>
              <button
                tabIndex={0}
                onClick={handleDismiss}
                className="p-1 text-zinc-500 hover:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
                aria-label="Dismiss"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          )}

          {state.phase === 'downloading' && (
            <>
              <svg className="w-5 h-5 text-blue-400 shrink-0 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l-4-4m4 4l4-4" />
              </svg>
              <div className="flex flex-col gap-1 min-w-[140px]">
                <span className="text-sm text-zinc-300">Downloading update...</span>
                <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.round(state.percent)}%` }}
                  />
                </div>
              </div>
              <span className="text-xs text-zinc-500 tabular-nums">{Math.round(state.percent)}%</span>
            </>
          )}

          {state.phase === 'downloaded' && (
            <>
              <svg className="w-5 h-5 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-zinc-200">
                <span className="font-semibold text-white">{state.version}</span> ready to install
              </span>
              <button
                tabIndex={0}
                onClick={handleInstall}
                className="ml-1 px-3 py-1 text-sm font-medium bg-green-600 hover:bg-green-500 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Restart
              </button>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
