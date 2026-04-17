// Device-local input mode preference. Not synced to Firestore — each Deck may
// have different attached controllers, so the right mode is per-device.

export type InputMode = 'strict' | 'lax'

const STORAGE_KEY = 'dt_input_mode'
const DEFAULT: InputMode = 'strict'

export function getInputMode(): InputMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === 'lax' ? 'lax' : 'strict'
  } catch {
    return DEFAULT
  }
}

export function setInputMode(mode: InputMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // localStorage may be unavailable
  }
}
