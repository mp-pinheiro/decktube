import { doc, getDoc, setDoc, deleteDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { initFirebaseAuth, getFirebaseDb, isFirebaseReady, getFirebaseUser } from './firebase'
import { getIdToken } from './oauth'
import { getHistoryEntries, replaceHistoryEntries, type HistoryEntry } from './historyStore'
import { getAllPositions, replaceAllPositions, type PositionsMap } from './playbackStore'
import { getPreferences, replacePreferences, type UserPreferences } from './preferencesStore'
import { getWatchedMap, replaceWatchedMap, type WatchedMap } from './watchedStore'
import { syncLog } from './syncLog'

const MAX_ENTRIES = 200
const HISTORY_DEBOUNCE_MS = 500
const PLAYBACK_DEBOUNCE_MS = 30_000
const PREFERENCES_DEBOUNCE_MS = 500
const WATCHED_DEBOUNCE_MS = 500
const MAX_LISTENER_RETRIES = 5

let historyTimer: ReturnType<typeof setTimeout> | null = null
let playbackTimer: ReturnType<typeof setTimeout> | null = null
let preferencesTimer: ReturnType<typeof setTimeout> | null = null
let watchedTimer: ReturnType<typeof setTimeout> | null = null
let isSyncing = false
let syncStatus: 'idle' | 'syncing' | 'synced' | 'offline' | 'unauthenticated' = 'idle'
let realtimeUnsub: Unsubscribe | null = null
let lastWrittenAt = 0
let hashedUid: string | null = null
let initialSyncDone = false
let listenerRetryCount = 0

interface PendingWrite {
  type: 'history' | 'playback' | 'preferences' | 'watched'
  data: unknown
  timestamp: number
}
let offlineQueue: PendingWrite[] = []
let onlineListenerAttached = false

async function hashUid(uid: string): Promise<string> {
  const data = new TextEncoder().encode(uid)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function enqueue(write: PendingWrite) {
  const idx = offlineQueue.findIndex(w => w.type === write.type)
  if (idx >= 0) {
    offlineQueue[idx] = write
  } else {
    offlineQueue.push(write)
  }
}

async function flushOfflineQueue(): Promise<void> {
  if (offlineQueue.length === 0) return
  const ref = getUserDocRef()
  if (!ref) return

  const pending = [...offlineQueue]
  offlineQueue = []

  try {
    const now = Date.now()
    const payload: Record<string, unknown> = { updatedAt: now }
    for (const write of pending) {
      payload[write.type] = write.data
    }
    await setDoc(ref, payload, { merge: true })
    lastWrittenAt = now
    syncLog('info', 'flushOfflineQueue: flushed', `types=${pending.map(w => w.type).join(',')}`)
  } catch (err) {
    for (const write of pending) enqueue(write)
    syncLog('error', 'flushOfflineQueue: failed, re-enqueued', String(err))
  }
}

function startRealtimeListener(docRef: ReturnType<typeof doc>) {
  if (realtimeUnsub) return
  realtimeUnsub = onSnapshot(docRef, (snapshot) => {
    listenerRetryCount = 0
    if (!snapshot.exists()) return
    const data = snapshot.data() as {
      history?: HistoryEntry[]
      playback?: PositionsMap
      preferences?: UserPreferences
      watched?: WatchedMap
      updatedAt?: number
    }
    const remoteUpdatedAt = data.updatedAt || 0
    if (remoteUpdatedAt <= lastWrittenAt) return
    lastWrittenAt = remoteUpdatedAt
    if (data.history) replaceHistoryEntries(data.history)
    if (data.playback) replaceAllPositions(data.playback)
    if (data.preferences) replacePreferences(data.preferences)
    if (data.watched) replaceWatchedMap(data.watched)
    window.dispatchEvent(new Event('firestore-sync'))
    syncLog('info', 'realtime: update from other device', `history=${data.history?.length ?? 0} playback=${Object.keys(data.playback || {}).length} watched=${Object.keys(data.watched || {}).length}`)
  }, (err) => {
    syncLog('error', 'realtime: listener error', String(err))
    realtimeUnsub = null
    listenerRetryCount++
    if (listenerRetryCount <= MAX_LISTENER_RETRIES) {
      const delay = Math.min(1000 * Math.pow(2, listenerRetryCount), 30000)
      syncLog('info', 'realtime: scheduling retry', `attempt=${listenerRetryCount} delay=${delay}ms`)
      setTimeout(() => startRealtimeListener(docRef), delay)
    } else {
      syncLog('error', 'realtime: max retries reached, giving up')
    }
  })
}

export function stopRealtimeListener() {
  realtimeUnsub?.()
  realtimeUnsub = null
  initialSyncDone = false
  hashedUid = null
  listenerRetryCount = 0
}

function getUserDocRef() {
  const db = getFirebaseDb()
  const user = getFirebaseUser()
  if (!db || !user || !hashedUid) return null
  return doc(db, 'users', hashedUid)
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

function mergeWatched(local: WatchedMap, remote: WatchedMap): WatchedMap {
  const merged: WatchedMap = { ...remote }
  for (const [videoId, ts] of Object.entries(local)) {
    if (!merged[videoId] || ts > merged[videoId]) {
      merged[videoId] = ts
    }
  }
  return merged
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
  if (initialSyncDone && realtimeUnsub) return
  isSyncing = true

  try {
    syncStatus = 'syncing'
    syncLog('info', 'initSync: starting')

    const idToken = getIdToken()
    const user = await initFirebaseAuth(idToken)
    const db = getFirebaseDb()
    if (!db) throw new Error('Firestore not initialized')

    hashedUid = await hashUid(user.uid)

    // Migration: move plaintext UID doc to hashed doc
    const oldDocRef = doc(db, 'users', user.uid)
    const docRef = doc(db, 'users', hashedUid)
    const [oldSnapshot, newSnapshot] = await Promise.all([getDoc(oldDocRef), getDoc(docRef)])

    let snapshot = newSnapshot
    if (oldSnapshot.exists() && !newSnapshot.exists()) {
      syncLog('info', 'initSync: migrating plaintext UID doc to hashed doc')
      await setDoc(docRef, oldSnapshot.data())
      await deleteDoc(oldDocRef)
      snapshot = oldSnapshot
    } else if (oldSnapshot.exists()) {
      await deleteDoc(oldDocRef)
    }

    const localHistory = getHistoryEntries()
    const localPlayback = getAllPositions()
    const localPreferences = getPreferences()
    const localWatched = getWatchedMap()

    if (snapshot.exists()) {
      const remote = snapshot.data() as {
        history?: HistoryEntry[]
        playback?: PositionsMap
        preferences?: UserPreferences
        watched?: WatchedMap
        updatedAt?: number
      }

      const remoteUpdatedAt = remote.updatedAt || 0
      const mergedHistory = mergeHistoryForSync(localHistory, remote.history || [], remoteUpdatedAt)
      const mergedPlayback = mergePlayback(localPlayback, remote.playback || {})
      const mergedPreferences = remote.preferences || localPreferences
      const mergedWatched = mergeWatched(localWatched, remote.watched || {})

      replaceHistoryEntries(mergedHistory)
      replaceAllPositions(mergedPlayback)
      replacePreferences(mergedPreferences)
      replaceWatchedMap(mergedWatched)

      const now = Date.now()
      await setDoc(docRef, {
        history: mergedHistory,
        playback: mergedPlayback,
        preferences: mergedPreferences,
        watched: mergedWatched,
        updatedAt: now,
      })
      lastWrittenAt = now

      syncLog('info', 'initSync: merged', `local=${localHistory.length}/${Object.keys(localPlayback).length} remote=${(remote.history || []).length}/${Object.keys(remote.playback || {}).length} merged=${mergedHistory.length}/${Object.keys(mergedPlayback).length} watched=${Object.keys(mergedWatched).length}`)
    } else {
      const now = Date.now()
      await setDoc(docRef, {
        history: localHistory,
        playback: localPlayback,
        preferences: localPreferences,
        watched: localWatched,
        updatedAt: now,
      })
      lastWrittenAt = now
      syncLog('info', 'initSync: created new doc', `history=${localHistory.length} playback=${Object.keys(localPlayback).length}`)
    }

    syncStatus = 'synced'
    initialSyncDone = true
    startRealtimeListener(docRef)
    await flushOfflineQueue()

    if (!onlineListenerAttached) {
      window.addEventListener('online', () => { flushOfflineQueue() })
      onlineListenerAttached = true
    }

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
  if (historyTimer) clearTimeout(historyTimer)
  if (!isFirebaseReady()) {
    enqueue({ type: 'history', data: entries, timestamp: Date.now() })
    return
  }
  historyTimer = setTimeout(async () => {
    const ref = getUserDocRef()
    if (!ref) return
    try {
      const now = Date.now()
      await setDoc(ref, { history: entries, updatedAt: now }, { merge: true })
      lastWrittenAt = now
    } catch (err) {
      syncLog('error', 'syncHistory: failed', String(err))
      enqueue({ type: 'history', data: entries, timestamp: Date.now() })
    }
  }, HISTORY_DEBOUNCE_MS)
}

export function syncPlayback(positions: PositionsMap): void {
  if (playbackTimer) clearTimeout(playbackTimer)
  if (!isFirebaseReady()) {
    enqueue({ type: 'playback', data: positions, timestamp: Date.now() })
    return
  }
  playbackTimer = setTimeout(async () => {
    const ref = getUserDocRef()
    if (!ref) return
    try {
      const now = Date.now()
      await setDoc(ref, { playback: positions, updatedAt: now }, { merge: true })
      lastWrittenAt = now
    } catch (err) {
      syncLog('error', 'syncPlayback: failed', String(err))
      enqueue({ type: 'playback', data: positions, timestamp: Date.now() })
    }
  }, PLAYBACK_DEBOUNCE_MS)
}

export function syncWatched(watched: WatchedMap): void {
  if (watchedTimer) clearTimeout(watchedTimer)
  if (!isFirebaseReady()) {
    enqueue({ type: 'watched', data: watched, timestamp: Date.now() })
    return
  }
  watchedTimer = setTimeout(async () => {
    const ref = getUserDocRef()
    if (!ref) return
    try {
      const now = Date.now()
      await setDoc(ref, { watched, updatedAt: now }, { merge: true })
      lastWrittenAt = now
    } catch (err) {
      syncLog('error', 'syncWatched: failed', String(err))
      enqueue({ type: 'watched', data: watched, timestamp: Date.now() })
    }
  }, WATCHED_DEBOUNCE_MS)
}

export function syncPreferences(preferences: UserPreferences): void {
  if (preferencesTimer) clearTimeout(preferencesTimer)
  if (!isFirebaseReady()) {
    enqueue({ type: 'preferences', data: preferences, timestamp: Date.now() })
    return
  }
  preferencesTimer = setTimeout(async () => {
    const ref = getUserDocRef()
    if (!ref) return
    try {
      const now = Date.now()
      await setDoc(ref, { preferences, updatedAt: now }, { merge: true })
      lastWrittenAt = now
    } catch (err) {
      syncLog('error', 'syncPreferences: failed', String(err))
      enqueue({ type: 'preferences', data: preferences, timestamp: Date.now() })
    }
  }, PREFERENCES_DEBOUNCE_MS)
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
