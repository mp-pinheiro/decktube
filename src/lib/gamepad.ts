import { getInputMode } from './inputModeStore'

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

// Mode is read once at module load — switching requires app restart.
const inputMode = getInputMode()

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

function emitToast(message: string, type: 'info' | 'warning' = 'info') {
  console.log('[Gamepad] Toast:', message)
  window.dispatchEvent(new CustomEvent('gamepad-toast', { detail: { message, type } }))
}

function isSteamController(gamepad: Gamepad): boolean {
  const id = gamepad.id.toLowerCase()
  return id.includes('28de') || id.includes('valve') || id.includes('steam')
}

function filterGamepads(raw: (Gamepad | null)[]): Gamepad[] {
  const all: Gamepad[] = []
  const steam: Gamepad[] = []
  for (const gp of raw) {
    if (!gp) continue
    all.push(gp)
    if (isSteamController(gp)) {
      steam.push(gp)
      if (gp.timestamp > maxSteamTimestamp) maxSteamTimestamp = gp.timestamp
    }
  }

  // Lax mode: always poll everything including raw hardware. User is expected to
  // engage the input lock (Select → LB+RB) before opening the Steam overlay.
  if (inputMode === 'lax') return all

  if (steam.length === 0) return all

  // After focus restore, include raw hardware until a Steam virtual proves it's alive.
  // This handles: after switching to another game and back, the Steam virtual may be stale
  // (Steam routed it to the other game) while raw hardware still has active input.
  if (focusGraceActive) {
    const currentMax = Math.max(...steam.map(gp => gp.timestamp))
    if (currentMax > steamTimestampAtBlur) {
      focusGraceActive = false
      return steam
    }
    return all
  }

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
let windowFocusInitialised = false
let hadGamepads = false
let restartAttempted = false
let gamepadLossTimer: ReturnType<typeof setTimeout> | null = null
let initialSetupDone = false
let initialSetupTimer: ReturnType<typeof setTimeout> | null = null
let systemGamepadsDetected = false
let xboxRecoveryActive = false
let xboxRecoveryTimer: ReturnType<typeof setTimeout> | null = null
let rearmTimer: ReturnType<typeof setTimeout> | null = null
let maxSteamTimestamp = 0
let steamTimestampAtBlur = 0
let focusGraceActive = false
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
        steamTimestampAtBlur = maxSteamTimestamp
        console.log('[Gamepad] Window blurred – suppressing input')
      } else {
        focusGraceActive = true
        console.log('[Gamepad] Window focused – raw hardware fallback active until Steam responds')
      }
    })
  }
}

function pollGamepads() {
  const isFocused = !document.hidden && document.hasFocus() && windowFocused

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

    // Runs regardless of lockActive so unlock works.
    const lbPressed = gamepad.buttons[GAMEPAD_BUTTONS.LB]?.pressed ?? false
    const rbPressed = gamepad.buttons[GAMEPAD_BUTTONS.RB]?.pressed ?? false
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
      gamepad.buttons.forEach((button, index) => {
        prevStates[index] = button.pressed
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

    gamepad.buttons.forEach((button, index) => {
      if (bothHeld && (index === GAMEPAD_BUTTONS.LB || index === GAMEPAD_BUTTONS.RB)) {
        prevStates[index] = button.pressed
        return
      }
      const isPressed = button.pressed
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

  if (!initialSetupTimer) {
    initialSetupTimer = setTimeout(() => { initialSetupDone = true }, 2000)
  }

  const api = window.electronAPI
  const cleanupSystemGamepads = api?.onSystemGamepads?.((detected: boolean) => {
    systemGamepadsDetected = detected
    if (detected && filterGamepads([...navigator.getGamepads()]).length === 0) {
      console.log('[Gamepad] System gamepads detected but Gamepad API not yet active')
      window.dispatchEvent(new CustomEvent('gamepad-activation-needed'))
    }
  })
  const cleanupReconnectPrompt = api?.onReconnectPrompt?.(() => {
    console.log('[Gamepad] Xbox auto-reset failed, prompting user to reconnect')
    window.dispatchEvent(new CustomEvent('gamepad-reconnect-needed'))
  })

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

  const connectTimestamps = new Map<number, number>()

  const handleConnect = (e: GamepadEvent) => {
    if (knownIndices.has(e.gamepad.index)) return
    knownIndices.add(e.gamepad.index)
    connectTimestamps.set(e.gamepad.index, Date.now())
    hadGamepads = true
    if (gamepadLossTimer) { clearTimeout(gamepadLossTimer); gamepadLossTimer = null }
    const isSteam = isSteamController(e.gamepad)
    console.log('[Gamepad] Connected:', e.gamepad.id, 'at index', e.gamepad.index, isSteam ? '(steam)' : '(raw hardware)')
    if (isSteam) {
      window.dispatchEvent(new CustomEvent('gamepad-reconnected'))
      if (xboxRecoveryActive) {
        xboxRecoveryActive = false
        if (xboxRecoveryTimer) { clearTimeout(xboxRecoveryTimer); xboxRecoveryTimer = null }
      }
      // Delay re-arm so transient churn (game launch, Steam reassigning) doesn't re-enable recovery
      if (rearmTimer) clearTimeout(rearmTimer)
      rearmTimer = setTimeout(() => {
        rearmTimer = null
        api?.reportSteamConnected?.()
      }, 5000)
    }
    if (initialSetupDone && !isSteam) {
      emitToast('Controller connected')
    }
    if (systemGamepadsDetected) {
      window.dispatchEvent(new CustomEvent('gamepad-activated'))
    }
  }

  const handleDisconnect = (e: GamepadEvent) => {
    knownIndices.delete(e.gamepad.index)
    const connectTime = connectTimestamps.get(e.gamepad.index)
    connectTimestamps.delete(e.gamepad.index)

    // Cancel pending re-arm if a Steam controller disconnects — it wasn't stable
    if (isSteamController(e.gamepad) && rearmTimer) {
      clearTimeout(rearmTimer)
      rearmTimer = null
    }

    // Detect Xbox ephemeral virtual: Steam controller that lived < 1s
    // Only trigger when focused — background churn from Steam reassigning virtuals to another game is expected.
    // Skipped entirely in lax mode — raw hardware is already being polled, no recovery needed.
    if (inputMode === 'strict' && windowFocused && isSteamController(e.gamepad) && connectTime && (Date.now() - connectTime) < 1000) {
      console.log('[Gamepad] Steam virtual dropout detected (lived', Date.now() - connectTime, 'ms) — requesting Xbox recovery')
      xboxRecoveryActive = true
      if (xboxRecoveryTimer) clearTimeout(xboxRecoveryTimer)
      xboxRecoveryTimer = setTimeout(() => { xboxRecoveryActive = false }, 30000)
      api?.reportXboxDropout?.()
    }

    console.log('[Gamepad] Disconnected:', e.gamepad.id, 'at index', e.gamepad.index)
    previousButtonStates.delete(e.gamepad.index)
    for (const key of buttonHoldState.keys()) {
      if (key.startsWith(`${e.gamepad.index}-`)) buttonHoldState.delete(key)
    }

    if (initialSetupDone && !isSteamController(e.gamepad)) {
      emitToast('Controller disconnected')
    }

    const remaining = navigator.getGamepads().some(gp => gp !== null)
    if (hadGamepads && !remaining && !restartAttempted && !xboxRecoveryActive) {
      console.log('[Gamepad] All gamepads lost – will restart in 15s if none reconnect')
      gamepadLossTimer = setTimeout(() => {
        if (!navigator.getGamepads().some(gp => gp !== null)) {
          emitToast('No controller detected — restarting in 10s...', 'warning')
          gamepadLossTimer = setTimeout(() => {
            if (!navigator.getGamepads().some(gp => gp !== null)) {
              console.log('[Gamepad] Restarting app to recover gamepad')
              restartAttempted = true
              window.electronAPI?.restartApp()
            }
          }, 10000)
        }
      }, 5000)
    }
  }

  window.addEventListener('gamepadconnected', handleConnect)
  window.addEventListener('gamepaddisconnected', handleDisconnect)

  return () => {
    clearInterval(startupProbe)
    if (initialSetupTimer) { clearTimeout(initialSetupTimer); initialSetupTimer = null }
    if (rearmTimer) { clearTimeout(rearmTimer); rearmTimer = null }
    cleanupSystemGamepads?.()
    cleanupReconnectPrompt?.()
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
