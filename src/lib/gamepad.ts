const GAMEPAD_BUTTONS = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  SELECT: 8,
  START: 9,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
} as const

type GamepadButtonHandler = (button: string, pressed: boolean, isRepeat?: boolean) => void

let lockActive = false
export function setGamepadLockActive(active: boolean) { lockActive = active }

// Lock is triggered by holding LB + RB for LOCK_HOLD_MS.
// While the combo is held, individual LB/RB events are suppressed so pressing both
// doesn't also fire fullscreen and nextTab. Progress events drive the UI indicator.
export const LOCK_HOLD_MS = 1000
const lockHoldStart = new Map<number, number>()
const lockHoldEmitted = new Set<number>()
let lockProgress = 0

// When LB or RB is pressed alone, defer emission briefly to see if the other arrives.
// Without this, pressing LB slightly before RB fires fullscreen before the hold is detected.
const LB_RB_GRACE_MS = 80
const lbPending = new Map<number, number>()
const rbPending = new Map<number, number>()

function dispatchLockProgress(progress: number) {
  if (progress === lockProgress) return
  lockProgress = progress
  window.dispatchEvent(new CustomEvent('input-lock-progress', { detail: { progress } }))
}

function isSteamController(gamepad: Gamepad): boolean {
  const id = gamepad.id.toLowerCase()
  return id.includes('28de') || id.includes('valve') || id.includes('steam')
}

const AXIS_THRESHOLD = 0.5
const LIVE_WINDOW_MS = 1500

function parseId(id: string): string {
  const v = id.match(/vendor:\s*([0-9a-f]{4})/i)
  const p = id.match(/product:\s*([0-9a-f]{4})/i)
  return v && p ? `${v[1].toLowerCase()}:${p[1].toLowerCase()}` : ''
}

// Returns each pad's button state indexed by the standard GAMEPAD_BUTTONS layout.
// 8BitDo Ultimate 2 Wireless in DInput/Bluetooth mode (2dc8:6012) has a layout Chromium does not
// map (gamepad.mapping === ''): A/B are buttons 0/1 but X/Y are 3/4, shoulders 6/7, triggers on
// axes 4/5, and the D-pad on axes 6/7. Layout from SDL_GameControllerDB, confirmed against
// on-device logs. Standard-mapped pads (Steam virtual, Xbox) pass through unchanged.
function normalizeButtons(gp: Gamepad): boolean[] {
  const out = new Array<boolean>(16).fill(false)
  const b = gp.buttons
  if (parseId(gp.id) === '2dc8:6012' && gp.mapping !== 'standard') {
    const ax = gp.axes
    const p = (i: number) => b[i]?.pressed ?? false
    out[GAMEPAD_BUTTONS.A] = p(0)
    out[GAMEPAD_BUTTONS.B] = p(1)
    out[GAMEPAD_BUTTONS.X] = p(3)
    out[GAMEPAD_BUTTONS.Y] = p(4)
    out[GAMEPAD_BUTTONS.LB] = p(6)
    out[GAMEPAD_BUTTONS.RB] = p(7)
    out[GAMEPAD_BUTTONS.SELECT] = p(10)
    out[GAMEPAD_BUTTONS.START] = p(11)
    out[GAMEPAD_BUTTONS.LT] = (ax[5] ?? -1) > AXIS_THRESHOLD
    out[GAMEPAD_BUTTONS.RT] = (ax[4] ?? -1) > AXIS_THRESHOLD
    const dx = ax[6] ?? 0
    const dy = ax[7] ?? 0
    out[GAMEPAD_BUTTONS.DPAD_LEFT] = dx < -AXIS_THRESHOLD
    out[GAMEPAD_BUTTONS.DPAD_RIGHT] = dx > AXIS_THRESHOLD
    out[GAMEPAD_BUTTONS.DPAD_UP] = dy < -AXIS_THRESHOLD
    out[GAMEPAD_BUTTONS.DPAD_DOWN] = dy > AXIS_THRESHOLD
    return out
  }
  for (let i = 0; i < out.length; i++) out[i] = b[i]?.pressed ?? false
  return out
}

// Liveness drives steam-vs-raw selection. A pad is "live" if a button is held or changed within
// LIVE_WINDOW_MS. Driven by real button activity (not gamepad.timestamp), so it doesn't depend on
// Chromium's idle-timestamp behaviour.
const liveSnapshot = new Map<number, boolean[]>()
const lastInputAt = new Map<number, number>()

function updateLiveness(pads: Gamepad[], now: number) {
  for (const gp of pads) {
    const norm = normalizeButtons(gp)
    const prev = liveSnapshot.get(gp.index)
    let active = false
    for (let i = 0; i < norm.length; i++) {
      const was = prev ? prev[i] : false
      if (norm[i] || norm[i] !== was) { active = true; break }
    }
    liveSnapshot.set(gp.index, norm)
    if (active) lastInputAt.set(gp.index, now)
  }
}

function isLive(index: number, now: number): boolean {
  const t = lastInputAt.get(index)
  return t !== undefined && now - t < LIVE_WINDOW_MS
}

let rawFallbackActive = false
function setRawFallback(active: boolean) {
  if (active !== rawFallbackActive) {
    rawFallbackActive = active
    console.log('[Gamepad] raw-fallback', active ? 'engaged — reading controller Steam left unvirtualized' : 'released')
  }
}

function filterGamepads(raw: (Gamepad | null)[]): Gamepad[] {
  const now = performance.now()
  const all: Gamepad[] = []
  const steam: Gamepad[] = []
  const rawPads: Gamepad[] = []
  for (const gp of raw) {
    if (!gp) continue
    all.push(gp)
    if (isSteamController(gp)) steam.push(gp)
    else rawPads.push(gp)
  }
  updateLiveness(all, now)

  if (steam.length === 0) return all

  // Prefer the Steam virtual while it's the controller in use: it's standard-mapped and goes silent
  // under the Steam overlay (no input leak). But when the live controller is a raw pad Steam never
  // virtualized — an external controller placed first in Steam's controller order takes slot 0, gets
  // the Desktop Layout, and is left as a raw device while the idle virtual belongs to the built-in
  // pad — fall back to the raw pad so it works without reordering controllers in Steam.
  if (steam.some(gp => isLive(gp.index, now))) { setRawFallback(false); return steam }
  if (rawPads.some(gp => isLive(gp.index, now))) { setRawFallback(true); return rawPads }
  setRawFallback(false)
  return steam
}

let animationFrameId: number | null = null
let buttonHandlers: GamepadButtonHandler[] = []
const previousButtonStates = new Map<number, boolean[]>()

const lastButtonEmitTime = new Map<string, number>()
const BUTTON_DEDUP_MS = 16

const DPAD_BUTTONS: Set<number> = new Set([
  GAMEPAD_BUTTONS.DPAD_UP, GAMEPAD_BUTTONS.DPAD_DOWN,
  GAMEPAD_BUTTONS.DPAD_LEFT, GAMEPAD_BUTTONS.DPAD_RIGHT,
])
const REPEAT_INITIAL_DELAY = 400
const REPEAT_INTERVAL = 150

interface HoldState { lastEmit: number; repeating: boolean }
const buttonHoldState = new Map<string, HoldState>()

let wasFocused = true
let windowFocused = true
let overlayActive = false
let windowFocusInitialised = false
const knownIndices = new Set<number>()

function initWindowFocusTracking() {
  if (windowFocusInitialised) return
  windowFocusInitialised = true
  const api = window.electronAPI
  if (api?.onWindowFocus) {
    api.onWindowFocus((focused: boolean) => {
      windowFocused = focused
      if (!focused) {
        previousButtonStates.clear()
        buttonHoldState.clear()
        console.log('[Gamepad] Window blurred – suppressing input')
      } else {
        console.log('[Gamepad] Window focused')
      }
    })
  }
  // Steam overlay / QAM open: the main process detects it via gamescope focus atoms. Suppress input
  // while it's up — a raw (unvirtualized) controller keeps emitting and would leak into the app behind it.
  if (api?.onOverlayState) {
    api.onOverlayState((active: boolean) => {
      overlayActive = active
      if (active) {
        previousButtonStates.clear()
        buttonHoldState.clear()
      }
      console.log('[Gamepad] Steam overlay', active ? 'open – suppressing input' : 'closed')
    })
  }
}

function pollGamepads() {
  const isFocused = !document.hidden && document.hasFocus() && windowFocused && !overlayActive

  if (!isFocused) {
    if (wasFocused) {
      previousButtonStates.clear()
      buttonHoldState.clear()
      lbPending.clear()
      rbPending.clear()
      wasFocused = false
    }
    animationFrameId = requestAnimationFrame(pollGamepads)
    return
  }

  if (!wasFocused) {
    previousButtonStates.clear()
    buttonHoldState.clear()
    lbPending.clear()
    rbPending.clear()
    wasFocused = true
  }

  const gamepads = filterGamepads([...navigator.getGamepads()])

  function emitButton(buttonName: string, isRepeat = false) {
    const now = performance.now()
    const lastEmit = lastButtonEmitTime.get(buttonName) ?? 0
    if (now - lastEmit >= BUTTON_DEDUP_MS) {
      lastButtonEmitTime.set(buttonName, now)
      buttonHandlers.forEach(handler => handler(buttonName, true, isRepeat))
    }
  }

  let anyHoldActive = false

  for (const gamepad of gamepads) {
    const prevStates = previousButtonStates.get(gamepad.index) ?? []
    const norm = normalizeButtons(gamepad)

    // Runs regardless of lockActive so unlock works.
    const lbPressed = norm[GAMEPAD_BUTTONS.LB]
    const rbPressed = norm[GAMEPAD_BUTTONS.RB]
    const bothHeld = lbPressed && rbPressed
    const holdStartedAt = lockHoldStart.get(gamepad.index)

    if (bothHeld) {
      anyHoldActive = true
      if (holdStartedAt === undefined) {
        lockHoldStart.set(gamepad.index, Date.now())
      } else if (!lockHoldEmitted.has(gamepad.index)) {
        const elapsed = Date.now() - holdStartedAt
        const progress = Math.min(1, elapsed / LOCK_HOLD_MS)
        dispatchLockProgress(progress)
        if (elapsed >= LOCK_HOLD_MS) {
          lockHoldEmitted.add(gamepad.index)
          buttonHandlers.forEach(handler => handler('LOCK_TOGGLE', true, false))
        }
      }
    } else if (holdStartedAt !== undefined) {
      lockHoldStart.delete(gamepad.index)
      lockHoldEmitted.delete(gamepad.index)
    }

    if (lockActive) {
      norm.forEach((pressed, index) => {
        prevStates[index] = pressed
      })
      previousButtonStates.set(gamepad.index, prevStates)
      continue
    }

    // Flush deferred LB/RB if grace window expired and the other button never arrived.
    const now = Date.now()
    if (lbPending.has(gamepad.index) && !rbPressed && now - lbPending.get(gamepad.index)! >= LB_RB_GRACE_MS) {
      lbPending.delete(gamepad.index)
      emitButton('LB')
    }
    if (rbPending.has(gamepad.index) && !lbPressed && now - rbPending.get(gamepad.index)! >= LB_RB_GRACE_MS) {
      rbPending.delete(gamepad.index)
      emitButton('RB')
    }
    // Both arrived within the grace window — cancel pending, hold detection handles it.
    if (bothHeld) {
      lbPending.delete(gamepad.index)
      rbPending.delete(gamepad.index)
    }

    norm.forEach((isPressed, index) => {
      if (bothHeld && (index === GAMEPAD_BUTTONS.LB || index === GAMEPAD_BUTTONS.RB)) {
        prevStates[index] = isPressed
        return
      }
      const wasPressed = prevStates[index] || false
      const holdKey = `${gamepad.index}-${index}`

      if (isPressed && !wasPressed) {
        // Defer LB/RB to allow the other button to arrive before emitting.
        if (index === GAMEPAD_BUTTONS.LB && !rbPressed) {
          lbPending.set(gamepad.index, Date.now())
        } else if (index === GAMEPAD_BUTTONS.RB && !lbPressed) {
          rbPending.set(gamepad.index, Date.now())
        } else {
          const buttonName = Object.entries(GAMEPAD_BUTTONS).find(([, bi]) => bi === index)?.[0]
          if (buttonName) emitButton(buttonName)
        }
        if (DPAD_BUTTONS.has(index)) {
          buttonHoldState.set(holdKey, { lastEmit: Date.now(), repeating: false })
        }
      } else if (isPressed && wasPressed && DPAD_BUTTONS.has(index)) {
        const hold = buttonHoldState.get(holdKey)
        if (hold) {
          const now = Date.now()
          const elapsed = now - hold.lastEmit
          const threshold = hold.repeating ? REPEAT_INTERVAL : REPEAT_INITIAL_DELAY
          if (elapsed >= threshold) {
            const buttonName = Object.entries(GAMEPAD_BUTTONS).find(([, bi]) => bi === index)?.[0]
            if (buttonName) emitButton(buttonName, true)
            hold.lastEmit = now
            hold.repeating = true
          }
        }
      } else if (!isPressed) {
        // If LB/RB released before grace expired, flush immediately.
        if (index === GAMEPAD_BUTTONS.LB && lbPending.has(gamepad.index)) {
          lbPending.delete(gamepad.index)
          emitButton('LB')
        } else if (index === GAMEPAD_BUTTONS.RB && rbPending.has(gamepad.index)) {
          rbPending.delete(gamepad.index)
          emitButton('RB')
        }
        buttonHoldState.delete(holdKey)
      }

      prevStates[index] = isPressed
    })

    previousButtonStates.set(gamepad.index, prevStates)
  }

  if (!anyHoldActive && lockProgress !== 0) {
    dispatchLockProgress(0)
  }

  animationFrameId = requestAnimationFrame(pollGamepads)
}

export function initGamepad(handler: GamepadButtonHandler) {
  buttonHandlers.push(handler)
  initWindowFocusTracking()

  if (!animationFrameId) {
    animationFrameId = requestAnimationFrame(pollGamepads)
  }

  // NOTE: Chromium may not fire gamepadconnected for already-connected gamepads.
  // Probe and dispatch synthetic events so InputProvider's bootstrap fires.
  let startupProbeCount = 0
  const emitForExisting = () => {
    for (const gp of navigator.getGamepads()) {
      if (gp && !knownIndices.has(gp.index)) {
        knownIndices.add(gp.index)
        console.log('[Gamepad] Found already-connected gamepad:', gp.id, 'at index', gp.index)
        window.dispatchEvent(new GamepadEvent('gamepadconnected', { gamepad: gp }))
      }
    }
  }
  const startupProbe = setInterval(() => {
    startupProbeCount++
    emitForExisting()
    if (knownIndices.size > 0 || startupProbeCount >= 30) {
      clearInterval(startupProbe)
    }
  }, 500)
  requestAnimationFrame(emitForExisting)

  const handleConnect = (e: GamepadEvent) => {
    if (knownIndices.has(e.gamepad.index)) return
    knownIndices.add(e.gamepad.index)
    const isSteam = isSteamController(e.gamepad)
    console.log('[Gamepad] Connected:', e.gamepad.id, 'at index', e.gamepad.index, isSteam ? '(steam)' : '(raw hardware)')
  }

  const handleDisconnect = (e: GamepadEvent) => {
    knownIndices.delete(e.gamepad.index)
    console.log('[Gamepad] Disconnected:', e.gamepad.id, 'at index', e.gamepad.index)
    previousButtonStates.delete(e.gamepad.index)
    for (const key of buttonHoldState.keys()) {
      if (key.startsWith(`${e.gamepad.index}-`)) buttonHoldState.delete(key)
    }
  }

  window.addEventListener('gamepadconnected', handleConnect)
  window.addEventListener('gamepaddisconnected', handleDisconnect)

  return () => {
    clearInterval(startupProbe)
    buttonHandlers = buttonHandlers.filter(h => h !== handler)
    if (buttonHandlers.length === 0 && animationFrameId) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
      previousButtonStates.clear()
      buttonHoldState.clear()
    }
    window.removeEventListener('gamepadconnected', handleConnect)
    window.removeEventListener('gamepaddisconnected', handleDisconnect)
    knownIndices.clear()
  }
}

export function isGamepadConnected(): boolean {
  return filterGamepads([...navigator.getGamepads()]).length > 0
}
