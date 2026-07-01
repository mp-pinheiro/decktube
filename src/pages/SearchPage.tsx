import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { search, searchContinuation, type YouTubeSearchResult } from '../lib/youtube'
import { useInputContext } from '../contexts/InputContext'
import { useVideoCardActions } from '../hooks/useVideoCardActions'
import PagedVideoGrid from '../components/PagedVideoGrid'
import TabBar from '../components/TabBar'

export default function SearchPage() {
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const { registerActions, unregisterActions } = useInputContext()
  const { actions, menuElement } = useVideoCardActions()

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

  useEffect(() => {
    registerActions(actions)
    return () => unregisterActions()
  }, [registerActions, unregisterActions, actions])

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
        showWatchedBadge
        emptyMessage="No results found."
      />

      {menuElement}
    </div>
  )
}
