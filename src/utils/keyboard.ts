import { useState, useEffect, useCallback, useRef } from 'react'

interface KeyboardShortcutsReturn {
  currentVideoId: {
    value: string | null
    setter: (id: string) => void
  }
  isPlaying: {
    value: boolean
    setter: (playing: boolean) => void
  }
  togglePlay: () => void
  seek: (direction: 'forward' | 'backward') => void
  volume: {
    value: number
    setter: (volume: number) => void
  }
  setVolume: (volume: number) => void
  toggleFullscreen: () => void
}

export default function useKeyboardShortcuts(): KeyboardShortcutsReturn {
  const [currentVideoId, setCurrentVideoId] = useState<string | null>('XsaEmJXg2EU')
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolumeState] = useState(100)

  const playerRef = useRef<any>(null)

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev)
  }, [])

  const seek = useCallback((direction: 'forward' | 'backward') => {
    if (!playerRef.current) return

    const currentTime = playerRef.current.getCurrentTime()
    const seekAmount = 10
    const newTime = direction === 'forward'
      ? currentTime + seekAmount
      : Math.max(0, currentTime - seekAmount)

    playerRef.current.seekTo(newTime, true)
  }, [])

  const setVolume = useCallback((newVolume: number) => {
    setVolumeState(Math.min(100, Math.max(0, newVolume)))
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }, [])

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement
      const isInputFocused =
        activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA'

      if (isInputFocused) {
        if (e.key === 'Escape') {
          activeElement instanceof HTMLElement && activeElement.blur()
        }
        return
      }

      switch (e.key) {
        case ' ':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowLeft':
          e.preventDefault()
          seek('backward')
          break
        case 'ArrowRight':
          e.preventDefault()
          seek('forward')
          break
        case 'ArrowUp':
          e.preventDefault()
          setVolume(volume + 10)
          break
        case 'ArrowDown':
          e.preventDefault()
          setVolume(volume - 10)
          break
        case 'f':
        case 'F':
          e.preventDefault()
          toggleFullscreen()
          break
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [togglePlay, seek, volume, setVolume, toggleFullscreen])

  return {
    currentVideoId: {
      value: currentVideoId,
      setter: setCurrentVideoId,
    },
    isPlaying: {
      value: isPlaying,
      setter: setIsPlaying,
    },
    togglePlay,
    seek,
    volume: {
      value: volume,
      setter: setVolume,
    },
    setVolume,
    toggleFullscreen,
  }
}
