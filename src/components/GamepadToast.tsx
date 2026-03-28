import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Gamepad2 } from 'lucide-react'

interface Toast {
  id: number
  message: string
  type: 'info' | 'warning'
}

let nextId = 0

export default function GamepadToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [activationNeeded, setActivationNeeded] = useState(false)

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const { message, type } = (e as CustomEvent).detail
      const id = nextId++
      setToasts(prev => [...prev, { id, message, type }])
      if (type !== 'warning') {
        setTimeout(() => dismiss(id), 3000)
      }
    }
    window.addEventListener('gamepad-toast', handler)
    return () => window.removeEventListener('gamepad-toast', handler)
  }, [dismiss])

  const [reconnectNeeded, setReconnectNeeded] = useState(false)

  useEffect(() => {
    const onNeeded = () => setActivationNeeded(true)
    const onActivated = () => setActivationNeeded(false)
    window.addEventListener('gamepad-activation-needed', onNeeded)
    window.addEventListener('gamepad-activated', onActivated)
    return () => {
      window.removeEventListener('gamepad-activation-needed', onNeeded)
      window.removeEventListener('gamepad-activated', onActivated)
    }
  }, [])

  useEffect(() => {
    let dismissTimer: ReturnType<typeof setTimeout> | null = null
    const onReconnect = () => {
      setReconnectNeeded(true)
      dismissTimer = setTimeout(() => setReconnectNeeded(false), 30000)
    }
    const onReconnected = () => {
      setReconnectNeeded(false)
      if (dismissTimer) { clearTimeout(dismissTimer); dismissTimer = null }
    }
    window.addEventListener('gamepad-reconnect-needed', onReconnect)
    window.addEventListener('gamepad-reconnected', onReconnected)
    return () => {
      if (dismissTimer) clearTimeout(dismissTimer)
      window.removeEventListener('gamepad-reconnect-needed', onReconnect)
      window.removeEventListener('gamepad-reconnected', onReconnected)
    }
  }, [])

  return (
    <div className="fixed top-20 left-6 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {activationNeeded && (
          <motion.div
            key="activation"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-sm text-sm font-medium bg-zinc-800/80 text-zinc-100"
          >
            <Gamepad2 className="w-4 h-4 shrink-0" />
            Controller detected -- press any button to activate
          </motion.div>
        )}
        {reconnectNeeded && (
          <motion.div
            key="reconnect"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-sm text-sm font-medium bg-amber-900/80 text-amber-100"
          >
            <Gamepad2 className="w-4 h-4 shrink-0" />
            Xbox detected -- reconnect controller for full support
          </motion.div>
        )}
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
            transition={{ duration: 0.15 }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-sm text-sm font-medium ${
              toast.type === 'warning'
                ? 'bg-amber-900/80 text-amber-100'
                : 'bg-black/70 text-white'
            }`}
          >
            <Gamepad2 className="w-4 h-4 shrink-0" />
            {toast.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
