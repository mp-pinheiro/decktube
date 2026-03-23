import { useEffect, useState, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { pushInputLayer } from '../lib/inputLayer'
import { getThumbnailUrl } from '../lib/format'
import type { YouTubeVideo } from '../lib/youtube'

interface AutoPlayOverlayProps {
  open: boolean
  video: YouTubeVideo
  onPlay: () => void
  onCancel: () => void
}

const COUNTDOWN_SECONDS = 5

export default function AutoPlayOverlay({ open, video, onPlay, onCancel }: AutoPlayOverlayProps) {
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const onPlayRef = useRef(onPlay)
  const onCancelRef = useRef(onCancel)
  onPlayRef.current = onPlay
  onCancelRef.current = onCancel

  useEffect(() => {
    if (!open) {
      setCountdown(COUNTDOWN_SECONDS)
      return
    }

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          onPlayRef.current()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [open])

  useEffect(() => {
    if (!open) return

    return pushInputLayer('autoplay-overlay', (intent) => {
      if (intent === 'select' || intent === 'play') {
        onPlayRef.current()
        return true
      }
      if (intent === 'back') {
        onCancelRef.current()
        return true
      }
      return true
    })
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          transition={{ duration: 0.25 }}
          className="absolute inset-0 z-[35] flex items-center justify-center bg-black/80 backdrop-blur-sm"
        >
          <div className="flex flex-col items-center gap-3 p-6 bg-zinc-900/95 border border-white/10 rounded-2xl max-w-sm shadow-2xl">
            <p className="text-sm text-zinc-400 mb-1">Up next</p>
            <div className="w-64 aspect-video rounded-xl overflow-hidden bg-zinc-800">
              <img
                src={getThumbnailUrl(video)}
                alt={video.title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <h3 className="text-base font-semibold text-zinc-100 text-center line-clamp-2 leading-tight">
              {video.title}
            </h3>
            <span className="text-sm text-zinc-400">{video.channelName}</span>
            <div className="text-4xl font-bold text-white mt-2">{countdown}</div>
            <span className="text-sm text-zinc-500">Playing in {countdown}s...</span>
            <div className="flex gap-6 text-xs text-zinc-600 mt-2">
              <span><kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400 font-mono">A</kbd> Play now</span>
              <span><kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400 font-mono">B</kbd> Cancel</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
