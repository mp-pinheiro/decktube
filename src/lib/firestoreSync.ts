import { doc, getDoc, setDoc } from 'firebase/firestore'
import { initFirebaseAuth, getFirebaseDb, isFirebaseReady, getFirebaseUser } from './firebase'
import { getIdToken } from './oauth'
import { getHistoryEntries, replaceHistoryEntries, type HistoryEntry } from './historyStore'
import { getAllPositions, replaceAllPositions, type PositionsMap } from './playbackStore'
import { syncLog } from './syncLog'

const MAX_ENTRIES = 200
const HISTORY_DEBOUNCE_MS = 500
const PLAYBACK_DEBOUNCE_MS = 30_000

let historyTimer: ReturnType<typeof setTimeout> | null = null
let playbackTimer: ReturnType<typeof setTimeout> | null = null
let isSyncing = false
let syncStatus: 'idle' | 'syncing' | 'synced' | 'offline' | 'unauthenticated' = 'idle'

function getUserDocRef() {
  const db = getFirebaseDb()
  const user = getFirebaseUser()
  if (!db || !user) return null
  return doc(db, 'users', user.uid)
}

function mergeHistoryForSync(
  local: HistoryEntry[],
  remote: HistoryEntry[],
  remoteUpdatedAt: number,
): HistoryEntry[] {
  const map = new Map<string, HistoryEntry>()

  for (const entry of remote) {
    map.set(entry.video.videoId, entry)
  }

  for (const entry of local) {
    const videoId = entry.video.videoId
    const remoteEntry = map.get(videoId)

    if (remoteEntry) {
      if (entry.watchedAt > remoteEntry.watchedAt) {
        map.set(videoId, entry)
      }
    } else if (entry.watchedAt > remoteUpdatedAt) {
      map.set(videoId, entry)
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
    syncStatus = 'syncing'
    syncLog('info', 'initSync: starting')

    const idToken = getIdToken()
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
        updatedAt?: number
      }

      const remoteUpdatedAt = remote.updatedAt || 0
      const mergedHistory = mergeHistoryForSync(localHistory, remote.history || [], remoteUpdatedAt)
      const mergedPlayback = mergePlayback(localPlayback, remote.playback || {})

      replaceHistoryEntries(mergedHistory)
      replaceAllPositions(mergedPlayback)

      await setDoc(docRef, {
        history: mergedHistory,
        playback: mergedPlayback,
        updatedAt: Date.now(),
      })

      syncLog('info', 'initSync: merged', `local=${localHistory.length}/${Object.keys(localPlayback).length} remote=${(remote.history || []).length}/${Object.keys(remote.playback || {}).length} merged=${mergedHistory.length}/${Object.keys(mergedPlayback).length}`)
    } else {
      await setDoc(docRef, {
        history: localHistory,
        playback: localPlayback,
        updatedAt: Date.now(),
      })
      syncLog('info', 'initSync: created new doc', `history=${localHistory.length} playback=${Object.keys(localPlayback).length}`)
    }

    syncStatus = 'synced'
    window.dispatchEvent(new Event('firestore-sync'))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === 'No valid authentication available') {
      syncStatus = 'unauthenticated'
      syncLog('warn', 'initSync: unauthenticated', msg)
    } else {
      syncStatus = 'offline'
      syncLog('error', 'initSync: failed', msg)
    }
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
      await setDoc(ref, { history: entries, updatedAt: Date.now() }, { merge: true })
    } catch (err) {
      syncLog('error', 'syncHistory: failed', String(err))
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
      await setDoc(ref, { playback: positions, updatedAt: Date.now() }, { merge: true })
    } catch (err) {
      syncLog('error', 'syncPlayback: failed', String(err))
    }
  }, PLAYBACK_DEBOUNCE_MS)
}

export function getSyncStatus() {
  return syncStatus
}

export function getSyncDiagnostics() {
  return {
    syncStatus,
    isFirebaseReady: isFirebaseReady(),
    hasIdToken: !!getIdToken(),
    hasCurrentUser: !!getFirebaseUser(),
  }
}
