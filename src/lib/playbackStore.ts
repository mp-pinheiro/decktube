const STORAGE_KEY = 'yt_playback_positions'
const MAX_ENTRIES = 200

interface PositionEntry {
  position: number
  updatedAt: number
}

type PositionsMap = Record<string, PositionEntry>

function loadPositions(): PositionsMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as PositionsMap
  } catch {
    return {}
  }
}

function storePositions(map: PositionsMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // localStorage may be unavailable or full
  }
}

export function savePlaybackPosition(videoId: string, position: number, duration: number): void {
  if (position < 10 || duration - position < 30) {
    clearPlaybackPosition(videoId)
    return
  }

  const map = loadPositions()

  if (!(videoId in map) && Object.keys(map).length >= MAX_ENTRIES) {
    const oldest = Object.entries(map).sort((a, b) => a[1].updatedAt - b[1].updatedAt)[0]
    if (oldest) delete map[oldest[0]]
  }

  map[videoId] = { position, updatedAt: Date.now() }
  storePositions(map)
}

export function getPlaybackPosition(videoId: string): number | null {
  const map = loadPositions()
  return map[videoId]?.position ?? null
}

export function clearPlaybackPosition(videoId: string): void {
  const map = loadPositions()
  if (videoId in map) {
    delete map[videoId]
    storePositions(map)
  }
}
