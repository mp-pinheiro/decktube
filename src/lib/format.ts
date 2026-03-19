export function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined || seconds === 0) return ''
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function formatViews(views: number | undefined): string {
  if (!views) return ''
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M views`
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K views`
  return `${views} views`
}

export function getThumbnailUrl(item: { thumbnails: Array<{ url: string; width: number }> }): string {
  const mediumThumb = item.thumbnails.find(t => t.width === 320)
  const highThumb = item.thumbnails.find(t => t.width === 480)
  return mediumThumb?.url || highThumb?.url || item.thumbnails[0]?.url || ''
}
