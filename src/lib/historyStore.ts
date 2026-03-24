import type { YouTubeVideo } from './youtube'
import { syncHistory } from './firestoreSync'
import { markUnwatched } from './watchedStore'

const STORAGE_KEY = 'yt_watch_history'
const MAX_ENTRIES = 200

export interface HistoryEntry {
  video: YouTubeVideo
  watchedAt: number
  position: number
  duration: number
}

function loadEntries(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as HistoryEntry[]
  } catch {
    return []
  }
}

function storeEntries(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // localStorage may be unavailable or full
  }
}

export function recordHistory(video: YouTubeVideo, position: number, duration: number): void {
  const entries = loadEntries().filter(e => e.video.videoId !== video.videoId)
  entries.unshift({ video, watchedAt: Date.now(), position, duration })
  if (entries.length > MAX_ENTRIES) {
    entries.length = MAX_ENTRIES
  }
  storeEntries(entries)
  syncHistory(entries)
}

export function getHistory(): YouTubeVideo[] {
  const seen = new Set<string>()
  return loadEntries()
    .filter(e => {
      if (seen.has(e.video.videoId)) return false
      seen.add(e.video.videoId)
      return true
    })
    .map(e => ({
      ...e.video,
      duration: e.video.duration || e.duration || undefined,
    }))
}

export function removeFromHistory(videoId: string): void {
  const entries = loadEntries().filter(e => e.video.videoId !== videoId)
  storeEntries(entries)
  syncHistory(entries)
  markUnwatched(videoId)
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // localStorage may be unavailable
  }
  syncHistory([])
}

export function getHistoryEntries(): HistoryEntry[] {
  return loadEntries()
}

export function replaceHistoryEntries(entries: HistoryEntry[]): void {
  storeEntries(entries)
}
