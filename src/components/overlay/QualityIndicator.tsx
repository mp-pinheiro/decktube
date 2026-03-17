import { AnimatePresence, motion } from 'motion/react'
import { useAutoFade } from '../PlayerOverlay'

interface QualityIndicatorProps {
  trigger: number
  label: string
}

export default function QualityIndicator({ trigger, label }: QualityIndicatorProps) {
  const visible = useAutoFade(trigger, 2000)

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={trigger}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, exit: { duration: 0.3 } }}
          className="absolute bottom-4 left-4 pointer-events-none"
        >
          <div className="bg-black/70 backdrop-blur-sm rounded-full px-3 py-1.5 text-sm text-white font-medium">
            {label}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
