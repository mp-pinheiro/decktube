import { useState, useEffect, useRef } from 'react'

// Shows `true` for `durationMs` after each increment of `trigger`, then fades back to `false`.
// Used by player overlay indicators (seek, volume, quality) that briefly appear on action.
export function useAutoFade(trigger: number, durationMs: number): boolean {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (trigger === 0) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- timer-driven visibility is the intended pattern
    setVisible(true)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setVisible(false), durationMs)
    return () => clearTimeout(timerRef.current)
  }, [trigger, durationMs])

  return visible
}
