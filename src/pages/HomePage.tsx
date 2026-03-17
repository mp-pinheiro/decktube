import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getHomeFeed, getHomeFeedContinuation } from '../lib/youtube'
import type { YouTubeVideo } from '../lib/youtube'
import { isAuthenticated } from '../lib/oauth'
import { motion } from 'motion/react'
import { useInputContext } from '../contexts/InputProvider'

export default function HomePage() {
  const [videos, setVideos] = useState<YouTubeVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [continuation, setContinuation] = useState<string | null>(null)
  const navigate = useNavigate()
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef<() => Promise<void>>(() => Promise.resolve())
  const { registerActions, unregisterActions } = useInputContext()

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
    if (!continuation || loadingMore) return
    setLoadingMore(true)
    try {
      const result = await getHomeFeedContinuation(continuation)
      setVideos(prev => {
        const existingIds = new Set(prev.map(v => v.videoId))
        const newVideos = result.videos.filter(v => !existingIds.has(v.videoId))
        return [...prev, ...newVideos]
      })
      setContinuation(result.continuation)
    } catch (err) {
      console.error('Failed to load more:', err)
    } finally {
      setLoadingMore(false)
    }
  }, [continuation, loadingMore])

  useEffect(() => {
    loadMoreRef.current = loadMore
  }, [loadMore])

  const loadingRef = useRef(loading)
  useEffect(() => {
    loadingRef.current = loading
  }, [loading])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingRef.current) {
          loadMoreRef.current()
        }
      },
      { rootMargin: '100px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

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
          <div className="flex items-center justify-between mb-8 px-2">
            <h2 className="text-2xl font-bold tracking-tight">Recommended</h2>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-3 gap-x-6 gap-y-10"
          >
            {videos.map((video) => (
              <Link
                key={video.videoId}
                to={`/watch/${video.videoId}`}
                data-video-id={video.videoId}
                data-channel-id={video.channelId}
                className="block group cursor-pointer flex flex-col gap-3 outline-none focus:outline-none focus:ring-2 focus:ring-red-500 rounded-2xl"
              >
                  <div className="relative aspect-video overflow-hidden rounded-2xl bg-zinc-800 border border-white/5 shadow-lg">
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

                  <div className="flex gap-3 px-1">
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

          {loadingMore && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-600" />
            </div>
          )}
        </>
      )}

      {/* Infinite scroll sentinel - always in DOM */}
      <div ref={sentinelRef} className="h-20" />
    </div>
  )
}
