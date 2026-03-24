import { syncWatched } from './firestoreSync'

const STORAGE_KEY = 'yt_watched_videos'

export type WatchedMap = Record<string, number>

function loadWatched(): WatchedMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as WatchedMap
  } catch {
    return {}
  }
}

function storeWatched(map: WatchedMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // localStorage may be unavailable or full
  }
}

export function markWatched(videoId: string): void {
  const map = loadWatched()
  if (map[videoId]) return
  map[videoId] = Date.now()
  storeWatched(map)
  syncWatched(map)
}

export function markUnwatched(videoId: string): void {
  const map = loadWatched()
  if (!(videoId in map)) return
  delete map[videoId]
  storeWatched(map)
  syncWatched(map)
}

export function isWatched(videoId: string): boolean {
  return videoId in loadWatched()
}

export function getWatchedMap(): WatchedMap {
  return loadWatched()
}

export function getWatchedSet(): Set<string> {
  return new Set(Object.keys(loadWatched()))
}

export function replaceWatchedMap(map: WatchedMap): void {
  storeWatched(map)
}
