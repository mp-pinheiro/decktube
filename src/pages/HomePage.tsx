import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getHomeFeed, getHomeFeedContinuation } from '../lib/youtube'
import type { YouTubeVideo } from '../lib/youtube'
import { isAuthenticated } from '../lib/oauth'
import { useInputContext } from '../contexts/InputProvider'
import PagedVideoGrid from '../components/PagedVideoGrid'
import TabBar from '../components/TabBar'

const TABS = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'subscriptions', label: 'Subscriptions' },
  { id: 'history', label: 'History' },
]

interface TabState {
  videos: YouTubeVideo[]
  loading: boolean
  error: string | null
  continuation: string | null
  fetched: boolean
}

function emptyTabState(): TabState {
  return { videos: [], loading: false, error: null, continuation: null, fetched: false }
}

export default function HomePage() {
  const navigate = useNavigate()
  const { registerActions, unregisterActions } = useInputContext()
  const [activeTab, setActiveTab] = useState('recommended')
  const [tabStates, setTabStates] = useState<Record<string, TabState>>({
    recommended: emptyTabState(),
    subscriptions: emptyTabState(),
    history: emptyTabState(),
  })

  const activeTabRef = useRef(activeTab)
  activeTabRef.current = activeTab

  const state = tabStates[activeTab]

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login', { replace: true })
    }
  }, [navigate])

  const fetchRecommended = useCallback(async () => {
    setTabStates(prev => ({
      ...prev,
      recommended: { ...prev.recommended, loading: true, error: null, fetched: true },
    }))
    try {
      const result = await getHomeFeed()
      setTabStates(prev => ({
        ...prev,
        recommended: { ...prev.recommended, videos: result.videos, continuation: result.continuation, loading: false },
      }))
    } catch (err) {
      setTabStates(prev => ({
        ...prev,
        recommended: { ...prev.recommended, error: err instanceof Error ? err.message : 'Failed to load videos', loading: false },
      }))
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'recommended' && !tabStates.recommended.fetched) {
      fetchRecommended()
    }
  }, [activeTab, tabStates.recommended.fetched, fetchRecommended])

  const loadMore = useCallback(async () => {
    const tab = activeTabRef.current
    const cont = tabStates[tab]?.continuation
    if (!cont || tab !== 'recommended') return
    try {
      const result = await getHomeFeedContinuation(cont)
      setTabStates(prev => {
        const existing = prev[tab]
        const existingIds = new Set(existing.videos.map(v => v.videoId))
        const newVideos = result.videos.filter(v => !existingIds.has(v.videoId))
        return {
          ...prev,
          [tab]: { ...existing, videos: [...existing.videos, ...newVideos], continuation: result.continuation },
        }
      })
    } catch (err) {
      console.error('Failed to load more:', err)
    }
  }, [tabStates])

  const cycleTab = useCallback((direction: number) => {
    setActiveTab(prev => {
      const idx = TABS.findIndex(t => t.id === prev)
      const next = (idx + direction + TABS.length) % TABS.length
      return TABS[next].id
    })
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
      prevTab: () => cycleTab(-1),
      nextTab: () => cycleTab(1),
    })
    return () => unregisterActions()
  }, [registerActions, unregisterActions, goToVideo, goToChannel, cycleTab])

  return (
    <div>
      <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'recommended' && (
        <PagedVideoGrid
          key="recommended"
          videos={state.videos}
          loading={state.loading}
          error={state.error}
          continuation={state.continuation}
          onLoadMore={loadMore}
        />
      )}

      {activeTab === 'subscriptions' && (
        <div className="flex items-center justify-center py-20">
          <div className="text-zinc-400">Subscriptions coming soon</div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="flex items-center justify-center py-20">
          <div className="text-zinc-400">History coming soon</div>
        </div>
      )}
    </div>
  )
}
