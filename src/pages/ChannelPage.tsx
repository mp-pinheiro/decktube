import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getChannelVideos, type YouTubeVideo } from '../lib/youtube'
import { useInputContext } from '../contexts/InputProvider'
import PagedVideoGrid from '../components/PagedVideoGrid'
import TabBar from '../components/TabBar'

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

  const channelName = videos.length > 0 && videos[0].channelName ? videos[0].channelName : 'Channel'
  const tabs = useMemo(() => [{ id: 'videos', label: channelName }], [channelName])

  return (
    <div>
      <TabBar tabs={tabs} activeTab="videos" onTabChange={() => {}} />

      <PagedVideoGrid
        videos={videos}
        loading={loading}
        error={error}
        continuation={null}
        showChannel={false}
        emptyMessage="No videos found for this channel."
      />
    </div>
  )
}
