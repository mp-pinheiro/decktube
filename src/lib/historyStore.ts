import type { YouTubeVideo } from './youtube'

const STORAGE_KEY = 'yt_watch_history'
const MAX_ENTRIES = 200

interface HistoryEntry {
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
  const entries = loadEntries()
  const idx = entries.findIndex(e => e.video.videoId === video.videoId)
  if (idx !== -1) {
    entries.splice(idx, 1)
  }
  entries.unshift({ video, watchedAt: Date.now(), position, duration })
  if (entries.length > MAX_ENTRIES) {
    entries.length = MAX_ENTRIES
  }
  storeEntries(entries)
}

export function getHistory(): YouTubeVideo[] {
  return loadEntries().map(e => e.video)
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // localStorage may be unavailable
  }
}
