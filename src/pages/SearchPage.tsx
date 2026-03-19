import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { search, type YouTubeSearchResult } from '../lib/youtube'
import { motion } from 'motion/react'
import { useInputContext } from '../contexts/InputProvider'
import { formatViews, formatDuration, getThumbnailUrl } from '../lib/format'

export default function SearchPage() {
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const navigate = useNavigate()
  const { registerActions, unregisterActions } = useInputContext()

  const [results, setResults] = useState<YouTubeSearchResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function doSearch() {
      if (!query.trim()) return
      setLoading(true)
      try {
        const videos = await search(query)
        setResults(videos)
      } catch (err) {
        console.error('Search failed:', err)
      } finally {
        setLoading(false)
      }
    }

    doSearch()
  }, [query])

  const goToVideo = useCallback(() => {
    const activeEl = document.activeElement
    const link = activeEl?.closest('a[data-video-id]') as HTMLElement | null
    if (link) {
      link.click()
    }
  }, [])

  const goToChannel = useCallback(() => {
    const activeEl = document.activeElement
    const resultCard = activeEl?.closest('[data-video-id]')
    const channelId = resultCard?.getAttribute('data-channel-id')
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

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-zinc-100">Search results for "{query}"</h1>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600" />
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-20 text-zinc-400">
          No results found.
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col gap-4 max-w-4xl mx-auto"
        >
          {results.map((video) => (
            <Link
              key={video.videoId}
              to={`/watch/${video.videoId}`}
              data-video-id={video.videoId}
              data-channel-id={video.channelId}
              className="group flex gap-4 p-4 rounded-xl hover:bg-zinc-900 transition-colors focus:outline-none focus:ring-2 focus:ring-red-600 outline-none"
            >
              <div className="relative w-64 md:w-80 shrink-0 aspect-video bg-zinc-800 rounded-xl overflow-hidden border border-white/5">
                <img
                  src={getThumbnailUrl(video)}
                  alt={video.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                {video.duration && video.duration > 0 && (
                  <div className="absolute bottom-2 right-2 rounded-sm bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                    {formatDuration(video.duration)}
                  </div>
                )}
              </div>

              <div className="flex flex-col py-1 gap-1">
                <h3 className="text-lg font-semibold line-clamp-2 text-zinc-100 group-hover:text-blue-400 transition-colors leading-snug">
                  {video.title}
                </h3>

                <span className="text-sm font-medium text-zinc-300">{video.channelName}</span>

                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <span>{formatViews(video.viewCount)}</span>
                  {video.publishedTimeText && (
                    <>
                      <span className="text-[8px] opacity-50">•</span>
                      <span>{video.publishedTimeText}</span>
                    </>
                  )}
                </div>

                {video.description && (
                  <p className="mt-2 text-sm text-zinc-500 line-clamp-2">{video.description}</p>
                )}
              </div>
            </Link>
          ))}
        </motion.div>
      )}
    </div>
  )
}
