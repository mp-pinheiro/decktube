import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getChannelVideos, type YouTubeVideo } from '../lib/youtube'
import { useInputContext } from '../contexts/InputProvider'

export default function ChannelPage() {
  const { channelId } = useParams<{ channelId: string }>()
  const [videos, setVideos] = useState<YouTubeVideo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { registerActions, unregisterActions } = useInputContext()

  useEffect(() => {
    async function loadChannel() {
      if (!channelId) return
      setLoading(true)
      setError(null)
      try {
        const fetchedVideos = await getChannelVideos(channelId)
        setVideos(fetchedVideos)
      } catch (err) {
        console.error('Failed to load channel:', err)
        setError('Failed to load channel videos.')
      } finally {
        setLoading(false)
      }
    }

    loadChannel()
  }, [channelId])

  const goToVideo = useCallback(() => {
    const activeEl = document.activeElement
    const videoCard = activeEl?.closest('[data-video-id]')
    const videoId = videoCard?.getAttribute('data-video-id')
    if (videoId) {
      navigate(`/watch/${videoId}`)
    }
  }, [navigate])

  useEffect(() => {
    registerActions({
      select: goToVideo,
    })
    return () => unregisterActions()
  }, [registerActions, unregisterActions, goToVideo])

  const formatViewCount = (views: number | undefined): string => {
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
    <div className="space-y-6">
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
        </div>
      ) : error ? (
        <div className="text-center py-20 text-red-500">
          {error}
        </div>
      ) : (
        <>
          <div className="mb-8 flex items-center justify-between border-b border-zinc-800 pb-4">
            <h1 className="text-2xl font-bold">
              {videos.length > 0 && videos[0].channelName ? videos[0].channelName : 'Channel'}
            </h1>
          </div>

          <div className="grid grid-cols-3 gap-x-6 gap-y-10">
            {videos.map((video) => (
              <Link
                key={video.videoId}
                to={`/watch/${video.videoId}`}
                data-video-id={video.videoId}
                className="group flex flex-col gap-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 outline-none"
              >
                <div className="relative w-full aspect-video bg-zinc-800 rounded-2xl overflow-hidden border border-white/5 shadow-lg">
                  <img
                    src={getThumbnailUrl(video)}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>

                <div className="flex flex-col gap-1 px-1">
                  <h3 className="text-sm font-semibold line-clamp-2 text-zinc-100 leading-snug group-hover:text-blue-400 transition-colors">
                    {video.title}
                  </h3>

                  <div className="flex items-center gap-1 text-xs text-zinc-400">
                    <span>{formatViewCount(video.viewCount)}</span>
                    {video.publishedTimeText && (
                      <>
                        <span className="text-[8px] opacity-50">•</span>
                        <span>{video.publishedTimeText}</span>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {videos.length === 0 && (
            <div className="text-center py-20 text-gray-400">
              No videos found for this channel.
            </div>
          )}
        </>
      )}
    </div>
  )
}
