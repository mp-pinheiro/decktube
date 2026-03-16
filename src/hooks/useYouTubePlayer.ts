import { useEffect, useRef, useState } from 'react'

interface YouTubePlayer {
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  setVolume: (volume: number) => void
  getVolume: () => number
  getDuration: () => number
  getCurrentTime: () => number
  getPlayerState: () => number
  loadVideoById: (videoId: string) => void
  destroy: () => void
}

declare global {
  interface Window {
    YT?: {
      Player: new (element: HTMLElement, config: any) => YouTubePlayer
      ready: (callback: () => void) => void
      PlayerState: {
        UNSTARTED: -1
        ENDED: 0
        PLAYING: 1
        PAUSED: 2
        BUFFERING: 3
        CUED: 5
      }
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

interface YouTubePlayerReturn {
  player: YouTubePlayer | null
  isReady: boolean
  isPlaying: boolean
  apiReady: boolean
}

export function useYouTubePlayer(
  videoId: string | null,
  containerRef: React.RefObject<HTMLDivElement | null>
): YouTubePlayerReturn {
  const [apiReady, setApiReady] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const playerRef = useRef<YouTubePlayer | null>(null)

  useEffect(() => {
    window.onYouTubeIframeAPIReady = () => {
      setApiReady(true)
    }

    if (window.YT) {
      window.YT.ready(() => setApiReady(true))
      return
    }

    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    const firstScriptTag = document.getElementsByTagName('script')[0]
    firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag)
  }, [])

  useEffect(() => {
    if (!apiReady || !videoId || !containerRef.current) return

    if (playerRef.current) {
      playerRef.current.loadVideoById(videoId)
      return
    }

    if (!window.YT) return

    const player = new window.YT.Player(containerRef.current, {
      height: '100%',
      width: '100%',
      videoId,
      playerVars: {
        autoplay: 1,
        controls: 1,
        modestbranding: 1,
        rel: 0,
      },
      events: {
        onReady: () => {
          setIsReady(true)
        },
        onStateChange: (event: { data: number }) => {
          setIsPlaying(event.data === (window.YT?.PlayerState.PLAYING ?? 1))
        },
      },
    })

    playerRef.current = player

    return () => {
      playerRef.current?.destroy()
      playerRef.current = null
      setIsReady(false)
    }
  }, [apiReady, videoId, containerRef])

  return {
    player: playerRef.current,
    isReady,
    isPlaying,
    apiReady,
  }
}

export default useYouTubePlayer
