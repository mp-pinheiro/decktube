import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getHomeFeed, getHomeFeedContinuation, getSubscriptionsFeed, getSubscriptionsFeedContinuation } from '../lib/youtube'
import type { YouTubeVideo } from '../lib/youtube'
import { isAuthenticated } from '../lib/oauth'
import { getHistory, removeFromHistory, clearHistory } from '../lib/historyStore'
import { getWatchedSet, markWatched, markUnwatched, isWatched } from '../lib/watchedStore'
import { forceBootstrapNavFocus } from '../lib/focusManager'
import { useInputContext } from '../contexts/InputProvider'
import { saveHomeNavState, consumeHomeNavState } from '../lib/homeNavState'
import PagedVideoGrid from '../components/PagedVideoGrid'
import TabBar from '../components/TabBar'
import ActionMenu from '../components/ActionMenu'

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
  const [restoredState] = useState(() => consumeHomeNavState())
  const [activeTab, setActiveTab] = useState(restoredState?.activeTab ?? 'recommended')
  const pageIndexRef = useRef<Record<string, number>>(
    restoredState ? { [restoredState.activeTab]: restoredState.pageIndex } : {}
  )
  const [tabStates, setTabStates] = useState<Record<string, TabState>>(() => {
    const tabs = restoredState?.tabs
    return {
      recommended: tabs?.recommended
        ? { videos: tabs.recommended.videos, continuation: tabs.recommended.continuation, loading: false, error: null, fetched: true }
        : emptyTabState(),
      subscriptions: tabs?.subscriptions
        ? { videos: tabs.subscriptions.videos, continuation: tabs.subscriptions.continuation, loading: false, error: null, fetched: true }
        : emptyTabState(),
      history: emptyTabState(),
    }
  })

  const [menuOpen, setMenuOpen] = useState(false)
  const [menuVideoId, setMenuVideoId] = useState<string | null>(null)
  const [watchedIds, setWatchedIds] = useState(() => getWatchedSet())

  const activeTabRef = useRef(activeTab)
  activeTabRef.current = activeTab
  const tabStatesRef = useRef(tabStates)
  tabStatesRef.current = tabStates

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

  const fetchSubscriptions = useCallback(async () => {
    setTabStates(prev => ({
      ...prev,
      subscriptions: { ...prev.subscriptions, loading: true, error: null, fetched: true },
    }))
    try {
      const result = await getSubscriptionsFeed()
      setTabStates(prev => ({
        ...prev,
        subscriptions: { ...prev.subscriptions, videos: result.videos, continuation: result.continuation, loading: false },
      }))
    } catch (err) {
      setTabStates(prev => ({
        ...prev,
        subscriptions: { ...prev.subscriptions, error: err instanceof Error ? err.message : 'Failed to load subscriptions', loading: false },
      }))
    }
  }, [])

  const fetchHistory = useCallback(() => {
    setTabStates(prev => ({
      ...prev,
      history: { ...prev.history, videos: getHistory(), continuation: null, fetched: true },
    }))
  }, [])

  useEffect(() => {
    if (activeTab === 'recommended' && !tabStates.recommended.fetched) {
      fetchRecommended()
    }
    if (activeTab === 'subscriptions' && !tabStates.subscriptions.fetched) {
      fetchSubscriptions()
    }
    if (activeTab === 'history') {
      fetchHistory()
    }
  }, [activeTab, tabStates.recommended.fetched, fetchRecommended, tabStates.subscriptions.fetched, fetchSubscriptions, fetchHistory])

  useEffect(() => {
    const onSync = () => {
      fetchHistory()
      setWatchedIds(getWatchedSet())
    }
    window.addEventListener('firestore-sync', onSync)
    return () => window.removeEventListener('firestore-sync', onSync)
  }, [fetchHistory])

  useEffect(() => {
    const onRefresh = () => {
      setTabStates({
        recommended: emptyTabState(),
        subscriptions: emptyTabState(),
        history: emptyTabState(),
      })
      setWatchedIds(getWatchedSet())
      pageIndexRef.current = {}
    }
    window.addEventListener('home-refresh', onRefresh)
    return () => window.removeEventListener('home-refresh', onRefresh)
  }, [])

  const loadingMoreRef = useRef(false)
  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current) return
    const tab = activeTabRef.current
    const cont = tabStates[tab]?.continuation
    if (!cont) return

    const fetchContinuation = tab === 'recommended'
      ? getHomeFeedContinuation
      : tab === 'subscriptions'
        ? getSubscriptionsFeedContinuation
        : null

    if (!fetchContinuation) return

    loadingMoreRef.current = true
    try {
      const result = await fetchContinuation(cont)
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
    } finally {
      loadingMoreRef.current = false
    }
  }, [tabStates])

  const cycleTab = useCallback((direction: number) => {
    setActiveTab(prev => {
      const idx = TABS.findIndex(t => t.id === prev)
      const next = (idx + direction + TABS.length) % TABS.length
      return TABS[next].id
    })
  }, [])

  const saveNavState = useCallback(() => {
    const activeEl = document.activeElement as HTMLElement | null
    const card = activeEl?.closest('[data-video-id]') as HTMLElement | null
    const grid = card?.closest('.grid')
    let focusIndex = 0
    if (grid && card) {
      const cards = Array.from(grid.querySelectorAll<HTMLElement>('[data-video-id]'))
      focusIndex = Math.max(0, cards.indexOf(card))
    }
    const ts = tabStatesRef.current
    const tabs: Record<string, { videos: YouTubeVideo[], continuation: string | null }> = {}
    if (ts.recommended.fetched) tabs.recommended = { videos: ts.recommended.videos, continuation: ts.recommended.continuation }
    if (ts.subscriptions.fetched) tabs.subscriptions = { videos: ts.subscriptions.videos, continuation: ts.subscriptions.continuation }
    saveHomeNavState({
      activeTab: activeTabRef.current,
      pageIndex: pageIndexRef.current[activeTabRef.current] ?? 0,
      focusIndex,
      tabs,
    })
  }, [])

  const goToVideo = useCallback(() => {
    const activeEl = document.activeElement
    const link = activeEl?.closest('a[data-video-id]') as HTMLElement | null
    if (link) {
      saveNavState()
      link.click()
    }
  }, [saveNavState])

  const goToChannel = useCallback(() => {
    const activeEl = document.activeElement
    const videoCard = activeEl?.closest('[data-video-id]')
    const channelId = videoCard?.getAttribute('data-channel-id')
    if (channelId) {
      saveNavState()
      navigate(`/channel/${channelId}`)
    }
  }, [navigate, saveNavState])

  const openModeMenu = useCallback(() => {
    const videoId = (document.activeElement?.closest('[data-video-id]') as HTMLElement | null)
      ?.getAttribute('data-video-id')
    if (!videoId) return
    setMenuVideoId(videoId)
    setMenuOpen(true)
  }, [])

  const handleMenuAction = useCallback((actionId: string) => {
    if (actionId === 'mark-watched' && menuVideoId) {
      markWatched(menuVideoId)
    } else if (actionId === 'mark-unwatched' && menuVideoId) {
      markUnwatched(menuVideoId)
    } else if (actionId === 'remove' && menuVideoId) {
      removeFromHistory(menuVideoId)
    } else if (actionId === 'clear') {
      clearHistory()
    }
    setMenuOpen(false)
    setMenuVideoId(null)
    setWatchedIds(getWatchedSet())
    fetchHistory()
    requestAnimationFrame(() => forceBootstrapNavFocus())
  }, [menuVideoId, fetchHistory])

  useEffect(() => {
    const actions: Record<string, () => void> = {
      select: goToVideo,
      channel: goToChannel,
      prevTab: () => cycleTab(-1),
      nextTab: () => cycleTab(1),
      mode: openModeMenu,
    }
    registerActions(actions)
    return () => unregisterActions()
  }, [registerActions, unregisterActions, goToVideo, goToChannel, cycleTab, openModeMenu])

  const menuItems = useMemo(() => {
    const videoWatched = menuVideoId ? isWatched(menuVideoId) : false
    if (activeTab === 'history') {
      return [
        videoWatched
          ? { id: 'mark-unwatched', label: 'Mark as unwatched' }
          : { id: 'mark-watched', label: 'Mark as watched' },
        { id: 'remove', label: 'Remove from history' },
        { id: 'clear', label: 'Clear all history', danger: true },
      ]
    }
    return [
      { id: 'mark-watched', label: 'Mark as watched' },
    ]
  }, [activeTab, menuVideoId])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'recommended' && (
        <PagedVideoGrid
          key="recommended"
          videos={state.videos.filter(v => !watchedIds.has(v.videoId))}
          loading={state.loading}
          error={state.error}
          continuation={state.continuation}
          onLoadMore={loadMore}
          initialPageIndex={restoredState?.activeTab === 'recommended' ? restoredState.pageIndex : undefined}
          initialFocusIndex={restoredState?.activeTab === 'recommended' ? restoredState.focusIndex : undefined}
          onPageChange={(idx) => { pageIndexRef.current['recommended'] = idx }}
        />
      )}

      {activeTab === 'subscriptions' && (
        <PagedVideoGrid
          key="subscriptions"
          videos={state.videos.filter(v => !watchedIds.has(v.videoId))}
          loading={state.loading}
          error={state.error}
          continuation={state.continuation}
          onLoadMore={loadMore}
          initialPageIndex={restoredState?.activeTab === 'subscriptions' ? restoredState.pageIndex : undefined}
          initialFocusIndex={restoredState?.activeTab === 'subscriptions' ? restoredState.focusIndex : undefined}
          onPageChange={(idx) => { pageIndexRef.current['subscriptions'] = idx }}
        />
      )}

      {activeTab === 'history' && (
        <PagedVideoGrid
          key={`history-${state.videos.length}`}
          videos={state.videos}
          loading={state.loading}
          error={state.error}
          continuation={null}
          onLoadMore={loadMore}
          initialPageIndex={restoredState?.activeTab === 'history' ? restoredState.pageIndex : undefined}
          initialFocusIndex={restoredState?.activeTab === 'history' ? restoredState.focusIndex : undefined}
          onPageChange={(idx) => { pageIndexRef.current['history'] = idx }}
          showWatchedBadge
        />
      )}

      <ActionMenu
        open={menuOpen}
        onClose={() => { setMenuOpen(false); setMenuVideoId(null) }}
        items={menuItems}
        onSelect={handleMenuAction}
      />
    </div>
  )
}
