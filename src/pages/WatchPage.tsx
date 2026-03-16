import { useParams, Link, useNavigate } from 'react-router-dom'
import { useEffect, useState, useCallback, useRef } from 'react'
import useYouTubePlayer from '../hooks/useYouTubePlayer'
import { getVideoDetails, type YouTubeVideo } from '../lib/youtube'
import { useInputContext } from '../contexts/InputProvider'

export default function WatchPage() {
  const { videoId } = useParams<{ videoId: string }>()
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const { player, isReady, apiReady, isPlaying } = useYouTubePlayer(videoId || null, containerRef)
  const { registerActions, unregisterActions } = useInputContext()

  const [volume, setVolumeState] = useState(100)
  const [videoData, setVideoData] = useState<YouTubeVideo | null>(null)

  useEffect(() => {
    async function loadData() {
      if (!videoId) return

      const details = await getVideoDetails(videoId)
      setVideoData(details)
    }

    loadData()
  }, [videoId])

  const togglePlay = useCallback(() => {
    if (!player || !isReady) return
    if (isPlaying) {
      player.pauseVideo()
    } else {
      player.playVideo()
    }
  }, [player, isReady, isPlaying])

  const seek = useCallback((delta: number) => {
    if (!player || !isReady) return

    const currentTime = player.getCurrentTime()
    const newTime = Math.max(0, currentTime + delta)

    player.seekTo(newTime, true)
  }, [player, isReady])

  const setVolume = useCallback((newVolume: number) => {
    const clamped = Math.min(100, Math.max(0, newVolume))
    setVolumeState(clamped)
    if (player && isReady) {
      player.setVolume(clamped)
    }
  }, [player, isReady])

  const toggleFullscreen = useCallback(() => {
    const playerContainer = document.getElementById('video-player-container')
    if (!playerContainer) return

    if (!document.fullscreenElement) {
      playerContainer.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }, [])

  const goToChannel = useCallback(() => {
    if (videoData?.channelId) {
      navigate(`/channel/${videoData.channelId}`)
    }
  }, [navigate, videoData])

  useEffect(() => {
    if (player && isReady) {
      player.setVolume(volume)
    }
  }, [volume, player, isReady])

  useEffect(() => {
    registerActions({
      play: togglePlay,
      channel: goToChannel,
      fullscreen: toggleFullscreen,
    })
    return () => unregisterActions()
  }, [registerActions, unregisterActions, togglePlay, goToChannel, toggleFullscreen])

  useEffect(() => {
    const handlePlayerKeydown = (e: KeyboardEvent) => {
      const isInputFocused = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA'

      if (isInputFocused) return

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault()
          seek(10)
          break
        case 'ArrowLeft':
          e.preventDefault()
          seek(-10)
          break
        case 'ArrowUp':
          e.preventDefault()
          setVolume(Math.min(100, volume + 10))
          break
        case 'ArrowDown':
          e.preventDefault()
          setVolume(Math.max(0, volume - 10))
          break
        case 'Escape':
          e.preventDefault()
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur()
          }
          break
      }
    }

    window.addEventListener('keydown', handlePlayerKeydown, true)
    return () => window.removeEventListener('keydown', handlePlayerKeydown, true)
  }, [seek, setVolume, volume])

  if (!videoId) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 mb-4">No video ID provided</p>
        <Link to="/" className="text-red-500 hover:text-red-400">
          Go to home
        </Link>
      </div>
    )
  }

  const formatViews = (views: number | undefined): string => {
    if (!views) return ''
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M views`
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K views`
    return `${views} views`
  }

  return (
    <div className="flex gap-6">
      <div className="flex-1">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-white/10 rounded-xl text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          ← Back
        </button>

        <div
          id="video-player-container"
          tabIndex={0}
          className="aspect-video bg-black rounded-2xl overflow-hidden relative focus:outline-none focus:ring-4 focus:ring-red-600 transition-shadow border border-white/5"
        >
          <div ref={containerRef} className="w-full h-full" />
          {!apiReady && (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-400">
              Loading player...
            </div>
          )}
        </div>

        {videoData && (
          <div className="mt-4">
            <h1 className="text-xl font-semibold text-zinc-100">{videoData.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              {videoData.channelId ? (
                <Link to={`/channel/${videoData.channelId}`} className="text-zinc-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-red-600 rounded">
                  {videoData.channelName}
                </Link>
              ) : (
                <span className="text-zinc-400">{videoData.channelName}</span>
              )}
              {videoData.viewCount !== undefined && (
                <>
                  <span className="text-zinc-600">•</span>
                  <span className="text-zinc-400">{formatViews(videoData.viewCount)}</span>
                </>
              )}
              {videoData.publishedTimeText && (
                <>
                  <span className="text-zinc-600">•</span>
                  <span className="text-zinc-400">{videoData.publishedTimeText}</span>
                </>
              )}
            </div>
            {videoData.description && (
              <p className="text-sm text-zinc-500 mt-2 line-clamp-3">{videoData.description}</p>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center gap-4 text-sm text-zinc-400">
          <div className="flex items-center gap-2">
            <span>Volume: {volume}%</span>
          </div>
          <div className="flex-1" />
          <div className="text-xs text-zinc-500">
            Space: Play/Pause | Arrows: Seek/Vol | F: Fullscreen | C: Channel | Esc: Back
          </div>
        </div>
      </div>
    </div>
  )
}
