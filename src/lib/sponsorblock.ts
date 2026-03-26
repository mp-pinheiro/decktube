const API_BASE = 'https://sponsor.ajay.app'
const CATEGORIES = ['sponsor', 'selfpromo', 'interaction', 'intro', 'outro', 'preview', 'filler']

export interface SponsorSegment {
  segment: [number, number]
  UUID: string
  category: string
  actionType: string
}

const cache = new Map<string, SponsorSegment[]>()

export async function getSegments(videoId: string): Promise<SponsorSegment[]> {
  const cached = cache.get(videoId)
  if (cached) return cached

  try {
    const params = new URLSearchParams({ videoID: videoId })
    for (const cat of CATEGORIES) params.append('category', cat)

    const res = await fetch(`${API_BASE}/api/skipSegments?${params}`)
    if (!res.ok) {
      cache.set(videoId, [])
      return []
    }

    const data = (await res.json()) as SponsorSegment[]
    const segments = data.filter(s => s.segment && s.segment.length === 2)
    console.info(`[SponsorBlock] ${videoId}: ${segments.length} segments`)
    cache.set(videoId, segments)
    return segments
  } catch {
    cache.set(videoId, [])
    return []
  }
}

export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    sponsor: 'sponsor',
    selfpromo: 'self-promo',
    interaction: 'interaction',
    intro: 'intro',
    outro: 'outro',
    preview: 'preview',
    filler: 'filler',
  }
  return labels[category] || category
}
