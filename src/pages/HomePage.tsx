import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getHomeFeed, getHomeFeedContinuation } from '../lib/youtube'
import type { YouTubeVideo } from '../lib/youtube'
import { isAuthenticated } from '../lib/oauth'
import { motion } from 'motion/react'
import { useInputContext } from '../contexts/InputProvider'
import { setNavFocus } from '../lib/focusManager'

const PAGE_SIZE = 6

export default function HomePage() {
  const [videos, setVideos] = useState<YouTubeVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [continuation, setContinuation] = useState<string | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const navigate = useNavigate()
  const { registerActions, unregisterActions } = useInputContext()

  const pageIndexRef = useRef(pageIndex)
  pageIndexRef.current = pageIndex
  const videosRef = useRef(videos)
  videosRef.current = videos
  const continuationRef = useRef(continuation)
  continuationRef.current = continuation
  const pendingFocusIndex = useRef<number | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const pageVideos = videos.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE)

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login', { replace: true })
      return
    }

    async function loadVideos() {
      setLoading(true)
      setError(null)
      try {
        const result = await getHomeFeed()
        setVideos(result.videos)
        setContinuation(result.continuation)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load videos')
      } finally {
        setLoading(false)
      }
    }

    loadVideos()
  }, [navigate])

  const loadMore = useCallback(async () => {
    if (!continuationRef.current) return
    try {
      const result = await getHomeFeedContinuation(continuationRef.current)
      setVideos(prev => {
        const existingIds = new Set(prev.map(v => v.videoId))
        const newVideos = result.videos.filter(v => !existingIds.has(v.videoId))
        return [...prev, ...newVideos]
      })
      setContinuation(result.continuation)
    } catch (err) {
      console.error('Failed to load more:', err)
    }
  }, [])

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return

      const grid = gridRef.current
      if (!grid) return

      const cards = Array.from(grid.querySelectorAll<HTMLElement>('[data-video-id]'))
      const activeEl = document.activeElement as HTMLElement
      const cardIndex = cards.indexOf(activeEl)
      if (cardIndex === -1) return

      const isBottomRow = cardIndex >= 3
      const isTopRow = cardIndex < 3
      const col = cardIndex % 3

      if (e.key === 'ArrowDown' && isBottomRow) {
        e.stopImmediatePropagation()
        e.preventDefault()
        const nextStart = (pageIndexRef.current + 1) * PAGE_SIZE
        if (nextStart < videosRef.current.length) {
          pendingFocusIndex.current = col
          setPageIndex(prev => prev + 1)
        }
        return
      }

      if (e.key === 'ArrowUp' && isTopRow && pageIndexRef.current > 0) {
        e.stopImmediatePropagation()
        e.preventDefault()
        pendingFocusIndex.current = 3 + col
        setPageIndex(prev => prev - 1)
        return
      }
    }

    window.addEventListener('keydown', handleKeydown, true)
    return () => window.removeEventListener('keydown', handleKeydown, true)
  }, [])

  useEffect(() => {
    const targetIndex = pendingFocusIndex.current
    if (targetIndex === null) return
    pendingFocusIndex.current = null

    requestAnimationFrame(() => {
      const grid = gridRef.current
      if (!grid) return
      const cards = Array.from(grid.querySelectorAll<HTMLElement>('[data-video-id]'))
      const target = cards[targetIndex]
      if (target) setNavFocus(target)
    })
  }, [pageIndex])

  useEffect(() => {
    if ((pageIndex + 1) * PAGE_SIZE >= videos.length && continuation) {
      loadMore()
    }
  }, [pageIndex, videos.length, continuation, loadMore])

  const goToVideo = useCallback(() => {
    const activeEl = document.activeElement
    const videoCard = activeEl?.closest('[data-video-id]')
    const videoId = videoCard?.getAttribute('data-video-id')
    if (videoId) {
      navigate(`/watch/${videoId}`)
    }
  }, [navigate])

  const goToChannel = useCallback(() => {
    const activeEl = document.activeElement
    const videoCard = activeEl?.closest('[data-video-id]')
    const channelId = videoCard?.getAttribute('data-channel-id')
    if (channelId) {
      navigate(`/channel/${channelId}`)
    }
  }, [navigate])

  useEffect(() => {
    registerActions({
      select: goToVideo,
      channel: goToChannel,
    })
    return () => unregisterActions()
  }, [registerActions, unregisterActions, goToVideo, goToChannel])

  const formatDuration = (seconds: number | undefined): string => {
    if (seconds === undefined || seconds === 0) return ''
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatViews = (views: number | undefined): string => {
    if (!views) return ''
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M views`
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K views`
    return `${views} views`
  }

  const getThumbnailUrl = (video: YouTubeVideo): string => {
    const mediumThumb = video.thumbnails.find(t => t.width === 320)
    const highThumb = video.thumbnails.find(t => t.width === 480)
    return mediumThumb?.url || highThumb?.url || video.thumbnails[0]?.url || ''
  }

  return (
    <div>
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-2xl p-4 text-red-300 mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600" />
        </div>
      ) : videos.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-zinc-400">No videos found</div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="text-2xl font-bold tracking-tight">Recommended</h2>
          </div>

          <motion.div
            key={pageIndex}
            ref={gridRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-3 grid-rows-2 gap-x-6 gap-y-4 h-[calc(100vh-12rem)]"
          >
            {pageVideos.map((video) => (
              <Link
                key={video.videoId}
                to={`/watch/${video.videoId}`}
                data-video-id={video.videoId}
                data-channel-id={video.channelId}
                className="group cursor-pointer flex flex-col gap-2 outline-none focus:outline-none focus:ring-2 focus:ring-red-500 rounded-2xl min-h-0"
              >
                  <div className="relative flex-1 min-h-0 overflow-hidden rounded-2xl bg-zinc-800 border border-white/5 shadow-lg">
                    <img
                      src={getThumbnailUrl(video)}
                      alt={video.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    {video.duration && video.duration > 0 && (
                      <div className="absolute bottom-2 right-2 rounded-sm bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                        {formatDuration(video.duration)}
                      </div>
                    )}
                  </div>

                  <div className="flex-shrink-0 flex gap-3 px-1">
                    <div className="flex flex-col gap-1 overflow-hidden">
                      <h3 className="line-clamp-2 text-sm font-semibold text-zinc-100 leading-snug group-hover:text-blue-400 transition-colors">
                        {video.title}
                      </h3>
                      <div className="flex flex-col text-xs text-zinc-400">
                        <span>{video.channelName}</span>
                        <div className="flex items-center gap-1">
                          <span>{video.viewCount ? formatViews(video.viewCount) : ''}</span>
                          {video.publishedTimeText && (
                            <>
                              <span className="text-[8px] opacity-50">•</span>
                              <span>{video.publishedTimeText}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
            ))}
          </motion.div>
        </>
      )}
    </div>
  )
}
