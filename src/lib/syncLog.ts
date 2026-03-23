const STORAGE_KEY = 'firestore_sync_log'
const MAX_ENTRIES = 50

export interface SyncLogEntry {
  ts: number
  level: 'info' | 'warn' | 'error'
  msg: string
  detail?: string
}

export function syncLog(level: SyncLogEntry['level'], msg: string, detail?: string): void {
  console[level](`[sync] ${msg}`, detail ?? '')

  const entries = getSyncLog()
  entries.push({ ts: Date.now(), level, msg, detail })
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES)
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // localStorage full — drop oldest half and retry
    entries.splice(0, Math.floor(entries.length / 2))
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    } catch {}
  }
}

export function getSyncLog(): SyncLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as SyncLogEntry[]
  } catch {
    return []
  }
}
