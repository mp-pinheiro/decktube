import type { YouTubeVideo } from './youtube'
import { getRelatedVideos } from './youtube'
import { getHistory } from './historyStore'
import { getWatchedSet } from './watchedStore'
import { getAllPositions } from './playbackStore'
import { getFeedbackSignals } from './feedbackStore'
import { tokenize } from './textTokens'

const SEED_COUNT = 12
const MAX_PER_CHANNEL = 3
const RELEVANCE_WEIGHT = 3

export async function getHistoryRecommendations(): Promise<YouTubeVideo[]> {
  const history = getHistory()
  if (history.length === 0) return []

  const watched = getWatchedSet()
  const positions = getAllPositions()
  const { likedVideos, dislikedVideos, likedChannels, dislikedChannels } = getFeedbackSignals()

  const engaged = history.filter(v =>
    watched.has(v.videoId) || positions[v.videoId] || likedVideos.has(v.videoId))
  const seedPool = engaged.length >= 3 ? engaged : history
  const seeds = seedPool.slice(0, SEED_COUNT)

  const historyIds = new Set(history.map(v => v.videoId))

  const historyChannels = new Map<string, number>()
  for (const v of seedPool) {
    if (v.channelId) historyChannels.set(v.channelId, (historyChannels.get(v.channelId) ?? 0) + 1)
  }

  const profile = new Map<string, number>()
  seeds.forEach((seed, i) => {
    const weight = SEED_COUNT - i
    for (const t of new Set(tokenize(`${seed.title} ${seed.channelName}`))) {
      profile.set(t, (profile.get(t) ?? 0) + weight)
    }
  })

  const related = await Promise.all(
    seeds.map(seed => getRelatedVideos(seed.videoId, true).catch(() => [] as YouTubeVideo[]))
  )

  interface Candidate { video: YouTubeVideo; recurrence: number; relevance: number }
  const candidates = new Map<string, Candidate>()
  related.forEach((videos, seedIndex) => {
    const weight = SEED_COUNT - seedIndex
    for (const video of videos) {
      if (historyIds.has(video.videoId) || watched.has(video.videoId)) continue
      if (dislikedVideos.has(video.videoId)) continue
      const ch = video.channelId
      if (ch && dislikedChannels.has(ch) && !likedChannels.has(ch)) continue

      const existing = candidates.get(video.videoId)
      if (existing) {
        existing.recurrence += weight
      } else {
        const relevance = [...new Set(tokenize(`${video.title} ${video.channelName}`))]
          .reduce((sum, t) => sum + (profile.get(t) ?? 0), 0)
        candidates.set(video.videoId, { video, recurrence: weight, relevance })
      }
    }
  })

  const list = Array.from(candidates.values())
  const maxRelevance = list.reduce((m, c) => Math.max(m, c.relevance), 0) || 1

  const scored = list.map(c => {
    const ch = c.video.channelId
    const liked = !!ch && likedChannels.has(ch)
    const familiar = !!ch && historyChannels.has(ch)

    let channelMult = 1
    if (liked) channelMult = 2 + Math.min(likedChannels.get(ch) ?? 0, 3)
    else if (familiar) channelMult = 1 + Math.min((historyChannels.get(ch) ?? 0) * 0.5, 1.5)

    const relevanceBoost = 1 + RELEVANCE_WEIGHT * (c.relevance / maxRelevance)
    const relevant = c.relevance > 0 || liked || familiar
    return { video: c.video, score: c.recurrence * channelMult * relevanceBoost, relevant }
  })

  const gated = scored.filter(s => s.relevant)
  const ranked = (gated.length > 0 ? gated : scored).sort((a, b) => b.score - a.score)

  const perChannel = new Map<string, number>()
  const out: YouTubeVideo[] = []
  for (const { video } of ranked) {
    const ch = video.channelId || ''
    const count = perChannel.get(ch) ?? 0
    if (ch && count >= MAX_PER_CHANNEL) continue
    perChannel.set(ch, count + 1)
    out.push(video)
  }
  return out
}
