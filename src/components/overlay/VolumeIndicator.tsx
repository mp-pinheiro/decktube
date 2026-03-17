import { AnimatePresence, motion } from 'motion/react'
import { Volume2, Volume1, VolumeX } from 'lucide-react'
import { useAutoFade } from '../PlayerOverlay'

interface VolumeIndicatorProps {
  trigger: number
  volume: number
  paused: boolean
}

function VolumeIcon({ volume }: { volume: number }) {
  if (volume === 0) return <VolumeX className="w-5 h-5 text-white" />
  if (volume < 50) return <Volume1 className="w-5 h-5 text-white" />
  return <Volume2 className="w-5 h-5 text-white" />
}

export default function VolumeIndicator({ trigger, volume, paused }: VolumeIndicatorProps) {
  const actionVisible = useAutoFade(trigger, 1500)
  const visible = actionVisible || paused

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={actionVisible ? trigger : 'paused'}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 12 }}
          transition={{ duration: 0.15, exit: { duration: 0.3 } }}
          className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 pointer-events-none"
        >
          <VolumeIcon volume={volume} />
          <div className="relative w-1.5 h-[120px] bg-white/20 rounded-full overflow-hidden">
            <div
              className="absolute bottom-0 w-full bg-white rounded-full transition-all duration-150"
              style={{ height: `${volume}%` }}
            />
          </div>
          <span className="text-xs text-white font-medium">{volume}%</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
