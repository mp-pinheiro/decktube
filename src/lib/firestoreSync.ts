import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore/lite'
import { initFirebaseAuth, getFirebaseDb, isFirebaseReady, getFirebaseUser } from './firebase'
import { getIdToken, refreshAccessToken } from './oauth'
import { getHistoryEntries, replaceHistoryEntries, type HistoryEntry } from './historyStore'
import { getAllPositions, replaceAllPositions, type PositionsMap } from './playbackStore'

const MAX_ENTRIES = 200
const HISTORY_DEBOUNCE_MS = 500
const PLAYBACK_DEBOUNCE_MS = 30_000

let historyTimer: ReturnType<typeof setTimeout> | null = null
let playbackTimer: ReturnType<typeof setTimeout> | null = null
let isSyncing = false
let syncStatus: 'idle' | 'syncing' | 'synced' | 'offline' | 'unauthenticated' = 'idle'

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return Date.now() >= payload.exp * 1000
  } catch {
    return true
  }
}

function getUserDocRef() {
  const db = getFirebaseDb()
  const user = getFirebaseUser()
  if (!db || !user) return null
  return doc(db, 'users', user.uid)
}

function mergeHistory(local: HistoryEntry[], remote: HistoryEntry[]): HistoryEntry[] {
  const map = new Map<string, HistoryEntry>()

  for (const entry of remote) {
    map.set(entry.video.videoId, entry)
  }
  for (const entry of local) {
    const existing = map.get(entry.video.videoId)
    if (!existing || entry.watchedAt > existing.watchedAt) {
      map.set(entry.video.videoId, entry)
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.watchedAt - a.watchedAt)
    .slice(0, MAX_ENTRIES)
}

function mergePlayback(local: PositionsMap, remote: PositionsMap): PositionsMap {
  const merged: PositionsMap = { ...remote }

  for (const [videoId, entry] of Object.entries(local)) {
    const existing = merged[videoId]
    if (!existing || entry.updatedAt > existing.updatedAt) {
      merged[videoId] = entry
    }
  }

  const entries = Object.entries(merged)
  if (entries.length <= MAX_ENTRIES) return merged

  entries.sort((a, b) => b[1].updatedAt - a[1].updatedAt)
  return Object.fromEntries(entries.slice(0, MAX_ENTRIES))
}

export async function initSync(): Promise<void> {
  if (isSyncing) return
  isSyncing = true

  try {
    let idToken = getIdToken()
    if (!idToken) {
      syncStatus = 'unauthenticated'
      return
    }

    if (isTokenExpired(idToken)) {
      await refreshAccessToken()
      idToken = getIdToken()
      if (!idToken || isTokenExpired(idToken)) {
        syncStatus = 'unauthenticated'
        return
      }
    }

    syncStatus = 'syncing'
    const user = await initFirebaseAuth(idToken)
    const db = getFirebaseDb()
    if (!db) throw new Error('Firestore not initialized')

    const docRef = doc(db, 'users', user.uid)
    const snapshot = await getDoc(docRef)

    const localHistory = getHistoryEntries()
    const localPlayback = getAllPositions()

    if (snapshot.exists()) {
      const remote = snapshot.data() as {
        history?: HistoryEntry[]
        playback?: PositionsMap
      }

      const mergedHistory = mergeHistory(localHistory, remote.history || [])
      const mergedPlayback = mergePlayback(localPlayback, remote.playback || {})

      replaceHistoryEntries(mergedHistory)
      replaceAllPositions(mergedPlayback)

      await setDoc(docRef, {
        history: mergedHistory,
        playback: mergedPlayback,
        updatedAt: Date.now(),
      })
    } else {
      await setDoc(docRef, {
        history: localHistory,
        playback: localPlayback,
        updatedAt: Date.now(),
      })
    }

    syncStatus = 'synced'
    window.dispatchEvent(new Event('firestore-sync'))
  } catch (err) {
    console.warn('Firestore init sync failed:', err)
    syncStatus = 'offline'
  } finally {
    isSyncing = false
  }
}

export function syncHistory(entries: HistoryEntry[]): void {
  if (!isFirebaseReady()) return
  if (historyTimer) clearTimeout(historyTimer)
  historyTimer = setTimeout(async () => {
    const ref = getUserDocRef()
    if (!ref) return
    try {
      await updateDoc(ref, { history: entries, updatedAt: Date.now() })
    } catch (err) {
      console.warn('Firestore history sync failed:', err)
    }
  }, HISTORY_DEBOUNCE_MS)
}

export function syncPlayback(positions: PositionsMap): void {
  if (!isFirebaseReady()) return
  if (playbackTimer) clearTimeout(playbackTimer)
  playbackTimer = setTimeout(async () => {
    const ref = getUserDocRef()
    if (!ref) return
    try {
      await updateDoc(ref, { playback: positions, updatedAt: Date.now() })
    } catch (err) {
      console.warn('Firestore playback sync failed:', err)
    }
  }, PLAYBACK_DEBOUNCE_MS)
}

export function getSyncStatus() {
  return syncStatus
}
