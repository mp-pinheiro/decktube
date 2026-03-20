import { useState, useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import type { YouTubeVideo } from '../lib/youtube'
import { setNavFocus } from '../lib/focusManager'
import { pushInputLayer } from '../lib/inputLayer'
import VideoCard from './VideoCard'

const PAGE_SIZE = 6

interface PagedVideoGridProps {
  videos: YouTubeVideo[]
  loading: boolean
  error: string | null
  continuation?: string | null
  onLoadMore?: () => void
  showChannel?: boolean
  emptyMessage?: string
}

export default function PagedVideoGrid({
  videos,
  loading,
  error,
  continuation = null,
  onLoadMore,
  showChannel = true,
  emptyMessage = 'No videos found',
}: PagedVideoGridProps) {
  const [pageIndex, setPageIndex] = useState(0)

  const pageIndexRef = useRef(pageIndex)
  pageIndexRef.current = pageIndex
  const videosRef = useRef(videos)
  videosRef.current = videos
  const continuationRef = useRef(continuation)
  continuationRef.current = continuation
  const pendingFocusIndex = useRef<number | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const pageVideos = videos.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE)

  useEffect(() => {
    return pushInputLayer('paged-grid', (intent) => {
      if (intent !== 'nav_down' && intent !== 'nav_up') return false

      const grid = gridRef.current
      if (!grid) return false

      const cards = Array.from(grid.querySelectorAll<HTMLElement>('[data-video-id]'))
      const activeEl = document.activeElement as HTMLElement
      const cardIndex = cards.indexOf(activeEl)
      if (cardIndex === -1) return false

      const isBottomRow = cardIndex >= 3
      const isTopRow = cardIndex < 3
      const col = cardIndex % 3

      if (intent === 'nav_down' && isBottomRow) {
        const nextStart = (pageIndexRef.current + 1) * PAGE_SIZE
        if (nextStart < videosRef.current.length) {
          pendingFocusIndex.current = col
          setPageIndex(prev => prev + 1)
        }
        return true
      }

      if (intent === 'nav_up' && isTopRow && pageIndexRef.current > 0) {
        pendingFocusIndex.current = 3 + col
        setPageIndex(prev => prev - 1)
        return true
      }

      return false
    })
  }, [])

  useEffect(() => {
    const targetIndex = pendingFocusIndex.current
    if (targetIndex === null) return
    pendingFocusIndex.current = null

    requestAnimationFrame(() => {
      const grid = gridRef.current
      if (!grid) return
      const cards = Array.from(grid.querySelectorAll<HTMLElement>('[data-video-id]'))
      const target = cards[targetIndex]
      if (target) setNavFocus(target)
    })
  }, [pageIndex])

  useEffect(() => {
    if (onLoadMore && (pageIndex + 1) * PAGE_SIZE >= videos.length && continuation) {
      onLoadMore()
    }
  }, [pageIndex, videos.length, continuation, onLoadMore])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-700 rounded-2xl p-4 text-red-300 mb-6">
        {error}
      </div>
    )
  }

  if (videos.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-zinc-400">{emptyMessage}</div>
      </div>
    )
  }

  return (
    <motion.div
      key={pageIndex}
      ref={gridRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="grid grid-cols-3 grid-rows-2 gap-x-4 gap-y-3 flex-1 min-h-0"
    >
      {pageVideos.map((video) => (
        <VideoCard key={video.videoId} video={video} showChannel={showChannel} />
      ))}
    </motion.div>
  )
}
