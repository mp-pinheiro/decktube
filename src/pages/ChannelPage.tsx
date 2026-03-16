import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getChannelVideos, type YouTubeVideo } from '../lib/youtube'
import { useInputContext } from '../contexts/InputProvider'

export default function ChannelPage() {
  const { channelId } = useParams<{ channelId: string }>()
  const [videos, setVideos] = useState<YouTubeVideo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
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

  useEffect(() => {
    registerActions({})
    return () => unregisterActions()
  }, [registerActions, unregisterActions])

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
          <div className="mb-6 flex items-center justify-between border-b border-gray-800 pb-4">
            <h1 className="text-2xl font-bold">
              {videos.length > 0 && videos[0].channelName ? videos[0].channelName : 'Channel'}
            </h1>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {videos.map((video) => (
              <Link
                key={video.videoId}
                to={`/watch/${video.videoId}`}
                data-video-id={video.videoId}
                className="group flex flex-col gap-2 rounded-xl hover:bg-gray-900 transition-colors p-2 focus:outline-none focus:ring-2 focus:ring-red-600 outline-none"
              >
                <div className="relative w-full aspect-video bg-gray-800 rounded-lg overflow-hidden">
                  <img
                    src={getThumbnailUrl(video)}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>

                <div className="flex flex-col py-1">
                  <h3 className="text-sm font-medium line-clamp-2 text-white group-hover:text-red-500 transition-colors">
                    {video.title}
                  </h3>

                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                    <span>{formatViewCount(video.viewCount)}</span>
                    {video.publishedTimeText && (
                      <>
                        <span>•</span>
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
