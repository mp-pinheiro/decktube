import { syncFeedback } from './firestoreSync'

const STORAGE_KEY = 'yt_video_feedback'

export type Sentiment = 'like' | 'dislike'

export interface FeedbackEntry {
  sentiment: Sentiment
  channelId: string
  ts: number
}

export type FeedbackMap = Record<string, FeedbackEntry>

function loadFeedback(): FeedbackMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as FeedbackMap
  } catch {
    return {}
  }
}

function storeFeedback(map: FeedbackMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // localStorage may be unavailable or full
  }
}

export function setFeedback(videoId: string, sentiment: Sentiment, channelId = ''): void {
  const map = loadFeedback()
  const existing = map[videoId]
  if (existing && existing.sentiment === sentiment) return
  map[videoId] = { sentiment, channelId: channelId || existing?.channelId || '', ts: Date.now() }
  storeFeedback(map)
  syncFeedback(map)
}

export function clearFeedback(videoId: string): void {
  const map = loadFeedback()
  if (!(videoId in map)) return
  delete map[videoId]
  storeFeedback(map)
  syncFeedback(map)
}

export function getFeedback(videoId: string): Sentiment | null {
  return loadFeedback()[videoId]?.sentiment ?? null
}

export function getFeedbackMap(): FeedbackMap {
  return loadFeedback()
}

export function replaceFeedbackMap(map: FeedbackMap): void {
  storeFeedback(map)
}

export interface FeedbackSignals {
  likedVideos: Set<string>
  dislikedVideos: Set<string>
  likedChannels: Map<string, number>
  dislikedChannels: Set<string>
}

export function getFeedbackSignals(): FeedbackSignals {
  const map = loadFeedback()
  const likedVideos = new Set<string>()
  const dislikedVideos = new Set<string>()
  const likedChannels = new Map<string, number>()
  const dislikedChannels = new Set<string>()
  for (const [videoId, entry] of Object.entries(map)) {
    if (entry.sentiment === 'like') {
      likedVideos.add(videoId)
      if (entry.channelId) likedChannels.set(entry.channelId, (likedChannels.get(entry.channelId) ?? 0) + 1)
    } else {
      dislikedVideos.add(videoId)
      if (entry.channelId) dislikedChannels.add(entry.channelId)
    }
  }
  return { likedVideos, dislikedVideos, likedChannels, dislikedChannels }
}
