import { AnimatePresence, motion } from 'motion/react'
import { useAutoFade } from '../PlayerOverlay'

interface QualityIndicatorProps {
  trigger: number
  label: string
  paused: boolean
}

export default function QualityIndicator({ trigger, label, paused }: QualityIndicatorProps) {
  const actionVisible = useAutoFade(trigger, 2000)
  const visible = actionVisible || paused

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={actionVisible ? trigger : 'paused'}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
          transition={{ duration: 0.15 }}
          className="absolute top-4 left-4 pointer-events-none"
        >
          <div className="bg-black/70 backdrop-blur-sm rounded-full px-3 py-1.5 text-sm text-white font-medium">
            {label}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
