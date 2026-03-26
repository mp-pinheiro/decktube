import { syncPreferences } from './firestoreSync'

const STORAGE_KEY = 'yt_user_preferences'

export interface UserPreferences {
  volume: number
  quality: string
  sponsorBlockEnabled: boolean
}

const DEFAULTS: UserPreferences = { volume: 100, quality: 'Auto', sponsorBlockEnabled: true }

function loadPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

function storePreferences(prefs: UserPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // localStorage may be unavailable or full
  }
}

export function getPreferences(): UserPreferences {
  return loadPreferences()
}

export function setVolume(volume: number): void {
  const prefs = loadPreferences()
  prefs.volume = volume
  storePreferences(prefs)
  syncPreferences(prefs)
}

export function setQuality(label: string): void {
  const prefs = loadPreferences()
  prefs.quality = label
  storePreferences(prefs)
  syncPreferences(prefs)
}

export function setSponsorBlock(enabled: boolean): void {
  const prefs = loadPreferences()
  prefs.sponsorBlockEnabled = enabled
  storePreferences(prefs)
  syncPreferences(prefs)
}

export function replacePreferences(prefs: UserPreferences): void {
  storePreferences(prefs)
}
