import { AnimatePresence, motion } from 'motion/react'
import { Play, Pause } from 'lucide-react'
import { useAutoFade } from '../PlayerOverlay'

interface PlayPauseIndicatorProps {
  trigger: number
  paused: boolean
}

export default function PlayPauseIndicator({ trigger, paused }: PlayPauseIndicatorProps) {
  const visible = useAutoFade(trigger, 800)

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={trigger}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, exit: { duration: 0.3 } }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div className="bg-black/60 backdrop-blur-sm rounded-full p-4">
            {paused ? (
              <Pause className="w-12 h-12 text-white" />
            ) : (
              <Play className="w-12 h-12 text-white" />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
