import type { YouTubeVideo } from './youtube'
import { getRelatedVideos } from './youtube'
import { getHistory } from './historyStore'
import { getWatchedSet } from './watchedStore'
import { getAllPositions } from './playbackStore'
import { getFeedbackSignals } from './feedbackStore'
import { tokenize } from './textTokens'

const SEED_COUNT = 12
const MAX_SEEDS_PER_CHANNEL = 2
const MAX_PER_CHANNEL = 3
const RELEVANCE_WEIGHT = 3
const RELATED_CONCURRENCY = 3
const MAX_RECURRENCE_SEEDS = 3

export async function getHistoryRecommendations(signal?: AbortSignal): Promise<YouTubeVideo[]> {
  const history = getHistory()
  if (history.length === 0) return []

  const watched = getWatchedSet()
  const positions = getAllPositions()
  const { likedVideos, dislikedVideos, likedChannels, dislikedChannels } = getFeedbackSignals()

  const engaged = history.filter(v =>
    watched.has(v.videoId) || positions[v.videoId] || likedVideos.has(v.videoId))
  const seedPool = engaged.length >= 3 ? engaged : history
  // Cap seeds per channel so a binge session doesn't dominate the candidate pool,
  // then backfill (at lowest weight) if there aren't enough diverse entries.
  const seeds: YouTubeVideo[] = []
  const overflow: YouTubeVideo[] = []
  const seedChannels = new Map<string, number>()
  for (const v of seedPool) {
    if (seeds.length >= SEED_COUNT) break
    // channelId is missing on some related-rail entries; fall back to name so caps still apply.
    const key = v.channelId || v.channelName || ''
    const count = key ? seedChannels.get(key) ?? 0 : 0
    if (key && count >= MAX_SEEDS_PER_CHANNEL) {
      overflow.push(v)
      continue
    }
    if (key) seedChannels.set(key, count + 1)
    seeds.push(v)
  }
  for (const v of overflow) {
    if (seeds.length >= SEED_COUNT) break
    seeds.push(v)
  }

  const historyIds = new Set(history.map(v => v.videoId))

  // Register both keys: history entries carry channelId, but related-rail
  // candidates often only have a channel name to match on.
  const historyChannels = new Map<string, number>()
  for (const v of seedPool) {
    for (const key of [v.channelId, v.channelName]) {
      if (key) historyChannels.set(key, (historyChannels.get(key) ?? 0) + 1)
    }
  }

  const profile = new Map<string, number>()
  seeds.forEach((seed, i) => {
    const weight = SEED_COUNT - i
    for (const t of new Set(tokenize(`${seed.title} ${seed.channelName}`))) {
      profile.set(t, (profile.get(t) ?? 0) + weight)
    }
  })

  // Bounded concurrency: an unbounded burst monopolizes the browser's per-origin
  // connection pool and starves navigation-critical requests (e.g. the player load
  // when a video is clicked while these are still in flight).
  const related: YouTubeVideo[][] = seeds.map(() => [])
  let nextSeed = 0
  const workers = Array.from({ length: Math.min(RELATED_CONCURRENCY, seeds.length) }, async () => {
    while (nextSeed < seeds.length && !signal?.aborted) {
      const i = nextSeed++
      related[i] = await getRelatedVideos(seeds[i].videoId, true, signal)
    }
  })
  await Promise.all(workers)
  if (signal?.aborted) return []

  interface Candidate { video: YouTubeVideo; recurrence: number; seedHits: number; relevance: number }
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
        // Saturate at a few seeds' consensus: globally-trending clips (e.g. breaking
        // news) recur across most rails and would otherwise out-score every niche pick.
        if (existing.seedHits < MAX_RECURRENCE_SEEDS) {
          existing.recurrence += weight
          existing.seedHits++
        }
      } else {
        // Title tokens only: matching a candidate's own channel name against the
        // profile would auto-boost every video from an already-watched channel.
        const relevance = [...new Set(tokenize(video.title))]
          .reduce((sum, t) => sum + (profile.get(t) ?? 0), 0)
        candidates.set(video.videoId, { video, recurrence: weight, seedHits: 1, relevance })
      }
    }
  })

  const list = Array.from(candidates.values())
  const maxRelevance = list.reduce((m, c) => Math.max(m, c.relevance), 0) || 1

  const scored = list.map(c => {
    const ch = c.video.channelId
    const chKey = ch || c.video.channelName
    const liked = !!ch && likedChannels.has(ch)
    const familiar = !!chKey && historyChannels.has(chKey)

    let channelMult = 1
    if (liked) channelMult = 2 + Math.min(likedChannels.get(ch) ?? 0, 3)
    else if (familiar) channelMult = 1 + Math.min((historyChannels.get(chKey) ?? 0) * 0.5, 1.5)

    const relevanceBoost = 1 + RELEVANCE_WEIGHT * (c.relevance / maxRelevance)
    const relevant = c.relevance > 0 || liked || familiar
    return { video: c.video, score: c.recurrence * channelMult * relevanceBoost, relevant }
  })

  const gated = scored.filter(s => s.relevant)
  const ranked = (gated.length > 0 ? gated : scored).sort((a, b) => b.score - a.score)

  // Greedy pick with a per-channel repetition penalty. Strict round-robin let
  // one-hit trending channels leapfrog the 2nd/3rd videos of channels the user
  // actually watches; dividing by uses keeps pages diverse without that inversion.
  const used = new Map<string, number>()
  const pool = ranked.slice()
  const out: YouTubeVideo[] = []
  while (pool.length > 0) {
    let bestIdx = -1
    let bestEff = 0
    for (let i = 0; i < pool.length; i++) {
      const { video, score } = pool[i]
      const key = video.channelId || video.channelName || video.videoId
      const uses = used.get(key) ?? 0
      if (uses >= MAX_PER_CHANNEL) continue
      const eff = score / (1 + uses)
      if (eff > bestEff) {
        bestEff = eff
        bestIdx = i
      }
    }
    if (bestIdx < 0) break
    const { video } = pool.splice(bestIdx, 1)[0]
    const key = video.channelId || video.channelName || video.videoId
    used.set(key, (used.get(key) ?? 0) + 1)
    out.push(video)
  }
  return out
}
