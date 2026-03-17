import { useState, useEffect, useRef, useCallback } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { MediaPlayerClass } from 'dashjs'
import { useAutoFade } from '../PlayerOverlay'

interface SeekIndicatorProps {
  trigger: number
  seekDelta: number
  videoEl: HTMLVideoElement | null
  dashPlayer: MediaPlayerClass | null
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function SeekIndicator({ trigger, seekDelta, videoEl, dashPlayer }: SeekIndicatorProps) {
  const expanded = useAutoFade(trigger, 2500)
  const [progress, setProgress] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const rafRef = useRef(0)

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const updateProgress = useCallback(() => {
    if (!videoEl) return

    const dur = dashPlayer ? dashPlayer.duration() : 0
    const cur = dashPlayer ? dashPlayer.time() : videoEl.currentTime || 0
    const safeDur = isFinite(dur) && dur > 0 ? dur : 0

    setDuration(safeDur)
    setCurrentTime(cur)
    setProgress(safeDur > 0 ? cur / safeDur : 0)

    if (videoEl.buffered.length > 0) {
      const end = videoEl.buffered.end(videoEl.buffered.length - 1)
      setBuffered(safeDur > 0 ? end / safeDur : 0)
    }
    rafRef.current = requestAnimationFrame(updateProgress)
  }, [videoEl, dashPlayer])

  useEffect(() => {
    if (!videoEl) return
    rafRef.current = requestAnimationFrame(updateProgress)
    return () => cancelAnimationFrame(rafRef.current)
  }, [videoEl, updateProgress])

  const deltaLabel = seekDelta > 0 ? `+${seekDelta}s` : `${seekDelta}s`

  return (
    <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
      <AnimatePresence>
        {expanded && (
          <motion.div
            key={trigger}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, exit: { duration: 0.3 } }}
            className="px-4 pb-2 flex items-center gap-3"
          >
            <span className="bg-black/70 backdrop-blur-sm rounded px-2 py-0.5 text-sm text-white font-medium tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            <span className="bg-black/70 backdrop-blur-sm rounded px-2 py-0.5 text-sm text-white/80 font-medium">
              {deltaLabel}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {(expanded || !isFullscreen) && (
        <div
          className="relative w-full transition-[height] duration-200"
          style={{ height: expanded ? 10 : 3 }}
        >
          <div className="absolute inset-0 bg-white/20" />
          <div
            className="absolute inset-y-0 left-0 bg-white/30"
            style={{ width: `${buffered * 100}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 bg-red-600"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}
    </div>
  )
}
