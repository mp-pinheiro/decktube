import type { YouTubeVideo } from './youtube'
import { getRelatedVideos } from './youtube'
import { getHistory } from './historyStore'
import { getWatchedSet } from './watchedStore'

const SEED_COUNT = 12

// Builds recommendations from DeckTube's own watch history, independent of YouTube's account feed.
// Takes the most recently watched videos as seeds, pulls YouTube's per-video related list for each,
// and ranks candidates by how often they recur across seeds, weighted by how recently the seed was
// watched. Anything already in history or marked watched is filtered out.
export async function getHistoryRecommendations(): Promise<YouTubeVideo[]> {
  const history = getHistory()
  if (history.length === 0) return []

  const seeds = history.slice(0, SEED_COUNT)
  const historyIds = new Set(history.map(v => v.videoId))
  const watched = getWatchedSet()

  const related = await Promise.all(
    seeds.map(seed => getRelatedVideos(seed.videoId).catch(() => [] as YouTubeVideo[]))
  )

  const scores = new Map<string, { video: YouTubeVideo; score: number }>()
  related.forEach((videos, seedIndex) => {
    // Recent seeds (lower index) weigh more; recurrence across seeds accumulates.
    const weight = SEED_COUNT - seedIndex
    for (const video of videos) {
      if (historyIds.has(video.videoId) || watched.has(video.videoId)) continue
      const existing = scores.get(video.videoId)
      if (existing) {
        existing.score += weight
      } else {
        scores.set(video.videoId, { video, score: weight })
      }
    }
  })

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .map(entry => entry.video)
}
