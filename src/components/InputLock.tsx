import { useEffect, useRef, useState } from 'react'
import { Lock, Unlock } from 'lucide-react'
import { pushInputLayer } from '../lib/inputLayer'
import { setGamepadLockActive } from '../lib/gamepad'

const ANIM_MS = 300

export default function InputLock() {
  const [locked, setLocked] = useState(false)
  const [progress, setProgress] = useState(0)
  // mounted keeps the overlay in the DOM during the exit animation
  const [mounted, setMounted] = useState(false)
  const [animIn, setAnimIn] = useState(false)
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const onToggle = () => setLocked(prev => !prev)
    window.addEventListener('input-lock-toggle', onToggle)
    return () => window.removeEventListener('input-lock-toggle', onToggle)
  }, [])

  useEffect(() => {
    const onProgress = (e: Event) => {
      const detail = (e as CustomEvent<{ progress: number }>).detail
      setProgress(detail?.progress ?? 0)
    }
    window.addEventListener('input-lock-progress', onProgress)
    return () => window.removeEventListener('input-lock-progress', onProgress)
  }, [])

  useEffect(() => {
    setGamepadLockActive(locked)
    if (!locked) return
    return pushInputLayer('input-lock', () => true)
  }, [locked])

  useEffect(() => {
    if (exitTimer.current) { clearTimeout(exitTimer.current); exitTimer.current = null }

    if (locked) {
      setMounted(true)
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimIn(true)))
    } else {
      setAnimIn(false)
      exitTimer.current = setTimeout(() => setMounted(false), ANIM_MS)
    }

    return () => { if (exitTimer.current) clearTimeout(exitTimer.current) }
  }, [locked])

  const showHoldIndicator = progress > 0 && progress < 1

  return (
    <>
      {mounted && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none"
          style={{
            backgroundColor: `rgba(0,0,0,${animIn ? 0.8 : 0})`,
            backdropFilter: animIn ? 'blur(4px)' : 'blur(0px)',
            transition: `background-color ${ANIM_MS}ms ease, backdrop-filter ${ANIM_MS}ms ease`,
          }}
        >
          <div
            style={{
              opacity: animIn ? 1 : 0,
              transform: animIn ? 'scale(1)' : 'scale(0.85)',
              transition: `opacity ${ANIM_MS}ms ease, transform ${ANIM_MS}ms ease`,
            }}
            className="bg-zinc-900 border border-white/10 rounded-2xl px-8 py-6 shadow-2xl flex flex-col items-center gap-3"
          >
            {animIn ? <Lock size={32} className="text-red-500" /> : <Unlock size={32} className="text-green-500" />}
            <div className="text-lg font-bold text-white tracking-wide">
              {animIn ? 'INPUT LOCKED' : 'UNLOCKED'}
            </div>
            <div className="text-sm text-zinc-400">
              Hold <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs font-mono text-zinc-300">LB + RB</kbd> or <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs font-mono text-zinc-300">-</kbd> for 3s to unlock
            </div>
          </div>
        </div>
      )}
      {showHoldIndicator && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[70] pointer-events-none">
          <div className="bg-zinc-900/95 border border-white/10 rounded-full px-4 py-2 shadow-2xl flex items-center gap-3 backdrop-blur-md">
            <ProgressRing progress={progress} locked={locked} />
            <span className="text-xs font-semibold text-white tracking-wide">
              {locked ? 'UNLOCKING...' : 'LOCKING...'}
            </span>
          </div>
        </div>
      )}
    </>
  )
}

function ProgressRing({ progress, locked }: { progress: number; locked: boolean }) {
  const size = 24
  const stroke = 3
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - progress)
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={stroke}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={locked ? '#22c55e' : '#ef4444'}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        fill="none"
        style={{ transition: 'stroke-dashoffset 60ms linear' }}
      />
    </svg>
  )
}
