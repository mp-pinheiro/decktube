import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { search, searchContinuation, type YouTubeSearchResult } from '../lib/youtube'
import { useInputContext } from '../contexts/InputProvider'
import PagedVideoGrid from '../components/PagedVideoGrid'
import TabBar from '../components/TabBar'

export default function SearchPage() {
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const navigate = useNavigate()
  const { registerActions, unregisterActions } = useInputContext()

  const [results, setResults] = useState<YouTubeSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [continuation, setContinuation] = useState<string | null>(null)

  useEffect(() => {
    async function doSearch() {
      if (!query.trim()) return
      setLoading(true)
      setError(null)
      try {
        const data = await search(query)
        setResults(data.videos)
        setContinuation(data.continuation)
      } catch (err) {
        console.error('Search failed:', err)
        setError('Search failed.')
      } finally {
        setLoading(false)
      }
    }

    doSearch()
  }, [query])

  const loadMore = useCallback(async () => {
    if (!continuation) return
    try {
      const data = await searchContinuation(continuation)
      setResults(prev => {
        const seen = new Set(prev.map(v => v.videoId))
        const unique = data.videos.filter(v => !seen.has(v.videoId))
        return [...prev, ...unique]
      })
      setContinuation(data.continuation)
    } catch (err) {
      console.error('Search continuation failed:', err)
    }
  }, [continuation])

  const goToVideo = useCallback(() => {
    const activeEl = document.activeElement
    const link = activeEl?.closest('a[data-video-id]') as HTMLElement | null
    if (link) {
      link.click()
    }
  }, [])

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

  const tabs = useMemo(() => [{ id: 'results', label: `Results for "${query}"` }], [query])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <TabBar tabs={tabs} activeTab="results" onTabChange={() => {}} />

      <PagedVideoGrid
        key={query}
        videos={results}
        loading={loading}
        error={error}
        continuation={continuation}
        onLoadMore={loadMore}
        emptyMessage="No results found."
      />
    </div>
  )
}
