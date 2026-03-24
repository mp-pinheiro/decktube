import { useParams, Link, useNavigate } from 'react-router-dom'
import HelpButton from '../components/HelpButton'
import { useEffect, useState, useCallback, useRef } from 'react'
import { MediaPlayer, type MediaPlayerClass, type Representation } from 'dashjs'
import { getVideoDetails, getPlayerData, generateMpd, getRelatedVideos, type YouTubeVideo, type MuxedFormat, generateCpn, reportPlaybackStart, reportWatchtime } from '../lib/youtube'
import { savePlaybackPosition, getPlaybackPosition, clearPlaybackPosition } from '../lib/playbackStore'
import { getPreferences, setVolume as persistVolume, setQuality as persistQuality } from '../lib/preferencesStore'
import { useInputContext } from '../contexts/InputProvider'
import QualitySelector, { type QualityOption } from '../components/QualitySelector'
import PlayerOverlay from '../components/PlayerOverlay'
import AutoPlayOverlay from '../components/AutoPlayOverlay'
import { formatViews } from '../lib/format'

function heightToLabel(height: number): string {
  if (height >= 2160) return '4K'
  return `${height}p`
}

function buildQualityOptions(representations: Representation[]): QualityOption[] {
  const sorted = [...representations].sort((a, b) => b.height - a.height)
  const options: QualityOption[] = [{ label: 'Auto', value: 'auto' }]
  for (const rep of sorted) {
    if (rep.height <= 0) continue
    const label = heightToLabel(rep.height)
    if (options.some(o => o.label === label)) continue
    options.push({ label, value: String(rep.id) })
  }
  return options
}

export default function WatchPage() {
  const { videoId } = useParams<{ videoId: string }>()
  const navigate = useNavigate()
  const videoElRef = useRef<HTMLVideoElement>(null)
  const dashPlayerRef = useRef<MediaPlayerClass | null>(null)
  const blobUrlRef = useRef<string | null>(null)
  const { registerActions, unregisterActions } = useInputContext()

  const [volume, setVolumeState] = useState(() => getPreferences().volume)
  const volumeRef = useRef(volume)
  volumeRef.current = volume
  const preferredQuality = useRef(getPreferences().quality)

  const [videoData, setVideoData] = useState<YouTubeVideo | null>(null)
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false)
  const [dashQualities, setDashQualities] = useState<QualityOption[]>([])
  const [currentQuality, setCurrentQuality] = useState('auto')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paused, setPaused] = useState(true)
  const initTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [isFullscreen, setIsFullscreen] = useState(false)
  const [playAction, setPlayAction] = useState(0)
  const [seekAction, setSeekAction] = useState(0)
  const [seekDelta, setSeekDelta] = useState(0)
  const [volumeAction, setVolumeAction] = useState(0)
  const [qualityAction, setQualityAction] = useState(0)

  const cpnRef = useRef<string>(generateCpn())
  const playbackStartedRef = useRef(false)

  const [nextVideo, setNextVideo] = useState<YouTubeVideo | null>(null)
  const [autoPlayVisible, setAutoPlayVisible] = useState(false)
  const nextVideoRef = useRef<YouTubeVideo | null>(null)
  useEffect(() => { nextVideoRef.current = nextVideo }, [nextVideo])

  const destroyDash = useCallback(() => {
    if (initTimerRef.current) {
      clearTimeout(initTimerRef.current)
      initTimerRef.current = null
    }
    if (dashPlayerRef.current) {
      dashPlayerRef.current.destroy()
      dashPlayerRef.current = null
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
  }, [])

  const initDash = useCallback((url: string, vid: string) => {
    if (!videoElRef.current) return

    const dp = MediaPlayer().create()

    dp.addRequestInterceptor(async (request) => {
      if (request.url && (request.url.includes('googlevideo.com') || request.url.includes('youtube.com'))) {
        request.url = `/stream-proxy?url=${encodeURIComponent(request.url)}`
      }
      return request
    })

    dp.initialize(videoElRef.current, url, true)

    initTimerRef.current = setTimeout(() => {
      if (!dp.isReady()) {
        setError('Player initialization timed out')
        setLoading(false)
        dp.destroy()
        dashPlayerRef.current = null
      }
    }, 30000)

    dp.on('streamInitialized', () => {
      if (initTimerRef.current) {
        clearTimeout(initTimerRef.current)
        initTimerRef.current = null
      }
      const reps = dp.getRepresentationsByType('video')
      const opts = reps?.length ? buildQualityOptions(reps) : []
      if (opts.length) setDashQualities(opts)
      dp.setVolume(volumeRef.current / 100)
      const saved = getPlaybackPosition(vid)
      if (saved !== null && videoElRef.current) {
        videoElRef.current.currentTime = saved
      }
      const pref = preferredQuality.current
      if (pref !== 'Auto') {
        const match = opts.find(q => q.label === pref)
        if (match && match.value !== 'auto') {
          dp.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: false } } } })
          dp.setRepresentationForTypeById('video', match.value, true)
          setCurrentQuality(match.value)
        }
      }
      setError(null)
      setLoading(false)
    })

    dp.on('error', (e: any) => {
      console.error('dash.js error:', e)
      if (!dp.isReady()) {
        if (initTimerRef.current) {
          clearTimeout(initTimerRef.current)
          initTimerRef.current = null
        }
        setError('Failed to load video stream')
        setLoading(false)
      }
    })

    dashPlayerRef.current = dp
  }, [])

  const initProgressive = useCallback((format: MuxedFormat, vid: string) => {
    const video = videoElRef.current
    if (!video) return

    const proxyUrl = `/stream-proxy?url=${encodeURIComponent(format.url)}`
    video.src = proxyUrl
    video.volume = volumeRef.current / 100

    const onLoadedData = () => {
      const saved = getPlaybackPosition(vid)
      if (saved !== null) {
        video.currentTime = saved
      }
      video.play().catch(() => {})
      setError(null)
      setLoading(false)
      video.removeEventListener('loadeddata', onLoadedData)
    }
    video.addEventListener('loadeddata', onLoadedData)
    video.load()
  }, [])

  useEffect(() => {
    if (!videoId) return

    setLoading(true)
    setError(null)
    setDashQualities([])
    setCurrentQuality('auto')
    setAutoPlayVisible(false)
    destroyDash()

    cpnRef.current = generateCpn()
    playbackStartedRef.current = false

    let cancelled = false

    async function load() {
      const [details, playerData] = await Promise.all([
        getVideoDetails(videoId!),
        getPlayerData(videoId!),
      ])

      if (cancelled) return

      setVideoData(details)

      const { mpd: mpdXml, representationCount } = generateMpd(playerData.adaptiveFormats)

      if (representationCount > 0) {
        const blob = new Blob([mpdXml], { type: 'application/dash+xml' })
        const blobUrl = URL.createObjectURL(blob)
        blobUrlRef.current = blobUrl
        initDash(blobUrl, videoId!)
        return
      }

      // DASH formats lack byte ranges -- fall back to muxed progressive stream
      if (playerData.muxedFormats.length > 0) {
        const best = playerData.muxedFormats.reduce((a, b) => a.bitrate > b.bitrate ? a : b)
        console.warn('DASH unavailable, using progressive fallback:', best.qualityLabel || best.itag)
        initProgressive(best, videoId!)
        return
      }

      setError('No playable streams found')
      setLoading(false)
    }

    load().catch((err) => {
      if (!cancelled) {
        console.error('Failed to load video:', err)
        setError(err instanceof Error ? err.message : 'Failed to load video data')
        setLoading(false)
      }
    })

    const saveInterval = setInterval(() => {
      const video = videoElRef.current
      if (!video) return
      const dp = dashPlayerRef.current
      const duration = dp ? dp.duration() : video.duration
      if (duration > 0 && !isNaN(duration)) {
        savePlaybackPosition(videoId!, video.currentTime, duration)
      }
    }, 15000)

    const watchtimeInterval = setInterval(() => {
      const video = videoElRef.current
      if (!video || !playbackStartedRef.current || video.paused) return
      const dp = dashPlayerRef.current
      const duration = dp ? dp.duration() : video.duration
      if (duration > 0 && !isNaN(duration)) {
        const segmentStart = Math.max(0, video.currentTime - 10)
        reportWatchtime(
          videoId!,
          cpnRef.current,
          video.currentTime,
          duration,
          [{ st: segmentStart, et: video.currentTime }],
          'playing'
        )
      }
    }, 10000)

    return () => {
      cancelled = true
      clearInterval(saveInterval)
      clearInterval(watchtimeInterval)
      const video = videoElRef.current
      const dp = dashPlayerRef.current
      const duration = dp ? dp.duration() : (video ? video.duration : 0)
      if (video && duration > 0 && !isNaN(duration)) {
        savePlaybackPosition(videoId!, video.currentTime, duration)
      }
      destroyDash()
    }
  }, [videoId, destroyDash, initDash, initProgressive])

  useEffect(() => {
    if (!videoId) return
    let cancelled = false
    setNextVideo(null)
    getRelatedVideos(videoId).then(videos => {
      if (!cancelled && videos.length > 0) setNextVideo(videos[0])
    })
    return () => { cancelled = true }
  }, [videoId])

  useEffect(() => {
    const video = videoElRef.current
    if (!video) return

    const onPlay = () => {
      setPaused(false)

      if (!playbackStartedRef.current && videoId) {
        playbackStartedRef.current = true
        const dp = dashPlayerRef.current
        const duration = dp ? dp.duration() : video.duration
        if (duration > 0 && !isNaN(duration)) {
          reportPlaybackStart(videoId, cpnRef.current, duration)
        }
      }
    }

    const onPause = () => {
      setPaused(true)
    }

    const onEnded = () => {
      if (videoId) clearPlaybackPosition(videoId)
      if (nextVideoRef.current) setAutoPlayVisible(true)
    }

    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('ended', onEnded)
    return () => {
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('ended', onEnded)
    }
  }, [videoId])

  const togglePlay = useCallback(() => {
    const video = videoElRef.current
    if (!video) return
    if (video.paused) {
      video.play()
        .then(() => setPlayAction(c => c + 1))
        .catch(() => {})
    } else {
      video.pause()
      setPlayAction(c => c + 1)
    }
  }, [])

  const seek = useCallback((delta: number) => {
    const video = videoElRef.current
    if (!video) return
    video.currentTime = Math.max(0, video.currentTime + delta)
    setSeekDelta(delta)
    setSeekAction(c => c + 1)
  }, [])

  const setVolume = useCallback((newVolume: number) => {
    const clamped = Math.min(100, Math.max(0, newVolume))
    setVolumeState(clamped)
    persistVolume(clamped)
    if (dashPlayerRef.current) {
      dashPlayerRef.current.setVolume(clamped / 100)
    } else if (videoElRef.current) {
      videoElRef.current.volume = clamped / 100
    }
    setVolumeAction(c => c + 1)
  }, [])

  const handleSelectQuality = useCallback((value: string) => {
    if (value === 'auto') {
      if (dashPlayerRef.current) {
        dashPlayerRef.current.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: true } } } })
        setCurrentQuality('auto')
        persistQuality('Auto')
        setQualityAction(c => c + 1)
      }
    } else {
      if (!dashPlayerRef.current) return
      dashPlayerRef.current.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: false } } } })
      dashPlayerRef.current.setRepresentationForTypeById('video', value, true)
      setCurrentQuality(value)
      const match = dashQualities.find(q => q.value === value)
      if (match) persistQuality(match.label)
      setQualityAction(c => c + 1)
    }
  }, [dashQualities])

  const toggleFullscreen = useCallback(() => {
    const playerContainer = document.getElementById('video-player-container')
    if (!playerContainer) return

    if (!document.fullscreenElement) {
      playerContainer.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }, [])

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
    }
  }, [])

  const goToChannel = useCallback(() => {
    if (videoData?.channelId) {
      navigate(`/channel/${videoData.channelId}`)
    }
  }, [navigate, videoData])

  const toggleQuality = useCallback(() => {
    setQualityMenuOpen(prev => !prev)
  }, [])

  const handleAutoPlay = useCallback(() => {
    if (!nextVideoRef.current) return
    setAutoPlayVisible(false)
    navigate(`/watch/${nextVideoRef.current.videoId}`)
  }, [navigate])

  const handleAutoPlayCancel = useCallback(() => {
    setAutoPlayVisible(false)
    navigate(-1)
  }, [navigate])

  useEffect(() => {
    registerActions({
      play: togglePlay,
      channel: goToChannel,
      fullscreen: toggleFullscreen,
      quality: toggleQuality,
      next: handleAutoPlay,
      nav_up: () => setVolume(Math.min(100, volume + 10)),
      nav_down: () => setVolume(Math.max(0, volume - 10)),
      nav_left: () => seek(-10),
      nav_right: () => seek(10),
    })
    return () => unregisterActions()
  }, [registerActions, unregisterActions, togglePlay, goToChannel, toggleFullscreen, toggleQuality, handleAutoPlay, seek, setVolume, volume])

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

  const qualityLabel = currentQuality === 'auto'
    ? 'Auto'
    : dashQualities.find(q => q.value === currentQuality)?.label || ''

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div
        id="video-player-container"
        tabIndex={0}
        className={`bg-black overflow-hidden relative focus:outline-none transition-shadow ${
          isFullscreen
            ? 'w-full h-full cursor-none'
            : 'flex-1 min-h-0 rounded-2xl border border-white/5 focus:ring-4 focus:ring-red-600'
        }`}
      >
        <video
          ref={videoElRef}
          className="w-full h-full object-contain"
        />
        <PlayerOverlay
          playAction={playAction}
          paused={paused}
          seekAction={seekAction}
          seekDelta={seekDelta}
          volumeAction={volumeAction}
          volume={volume}
          qualityAction={qualityAction}
          qualityLabel={qualityLabel}
          videoEl={videoElRef.current}
          dashPlayer={dashPlayerRef.current}
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-400">
            Loading player...
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-red-400">
            {error}
          </div>
        )}
        <QualitySelector
          open={qualityMenuOpen}
          onClose={() => setQualityMenuOpen(false)}
          qualities={dashQualities.length > 0 ? dashQualities : [{ label: 'Auto', value: 'auto' }]}
          currentQuality={currentQuality}
          onSelectQuality={handleSelectQuality}
        />
        {nextVideo && (
          <AutoPlayOverlay
            open={autoPlayVisible}
            video={nextVideo}
            onPlay={handleAutoPlay}
            onCancel={handleAutoPlayCancel}
          />
        )}
      </div>

      <div className="shrink-0 mt-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          {videoData && (
            <>
              <h1 className="text-lg leading-tight font-semibold text-zinc-100 line-clamp-1">{videoData.title}</h1>
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
            </>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <HelpButton inline />
        </div>
      </div>
    </div>
  )
}

