import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { getChannelVideos, type YouTubeVideo } from '../lib/youtube'
import { useInputContext } from '../contexts/InputContext'
import { useVideoCardActions } from '../hooks/useVideoCardActions'
import PagedVideoGrid from '../components/PagedVideoGrid'
import TabBar from '../components/TabBar'

export default function ChannelPage() {
  const { channelId } = useParams<{ channelId: string }>()
  const [videos, setVideos] = useState<YouTubeVideo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { registerActions, unregisterActions } = useInputContext()
  const { actions, menuElement } = useVideoCardActions()

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
    registerActions(actions)
    return () => unregisterActions()
  }, [registerActions, unregisterActions, actions])

  const channelName = videos.length > 0 && videos[0].channelName ? videos[0].channelName : 'Channel'
  const tabs = useMemo(() => [{ id: 'videos', label: channelName }], [channelName])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <TabBar tabs={tabs} activeTab="videos" onTabChange={() => {}} />

      <PagedVideoGrid
        videos={videos}
        loading={loading}
        error={error}
        continuation={null}
        showChannel={false}
        showWatchedBadge
        emptyMessage="No videos found for this channel."
      />

      {menuElement}
    </div>
  )
}
