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
    if (isSteamController(gp)) steam.push(gp)
  }
  return steam.length > 0 ? steam : all
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
const knownIndices = new Set<number>()

function initWindowFocusTracking() {
  if (windowFocusInitialised) return
  windowFocusInitialised = true
  const api = (window as any).electronAPI
  if (api?.onWindowFocus) {
    api.onWindowFocus((focused: boolean) => {
      windowFocused = focused
      if (!focused) {
        previousButtonStates.clear()
        buttonHoldState.clear()
        console.log('[Gamepad] Window blurred – suppressing input')
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
      wasFocused = false
    }
    animationFrameId = requestAnimationFrame(pollGamepads)
    return
  }

  if (!wasFocused) {
    previousButtonStates.clear()
    buttonHoldState.clear()
    wasFocused = true
  }

  const gamepads = filterGamepads([...navigator.getGamepads()])

  for (const gamepad of gamepads) {
    const prevStates = previousButtonStates.get(gamepad.index) ?? []

    gamepad.buttons.forEach((button, index) => {
      const isPressed = button.pressed
      const wasPressed = prevStates[index] || false
      const holdKey = `${gamepad.index}-${index}`

      if (isPressed && !wasPressed) {
        const buttonName = Object.entries(GAMEPAD_BUTTONS).find(([_, bi]) => bi === index)?.[0]
        if (buttonName) {
          const now = performance.now()
          const lastEmit = lastButtonEmitTime.get(buttonName) ?? 0
          if (now - lastEmit >= BUTTON_DEDUP_MS) {
            lastButtonEmitTime.set(buttonName, now)
            buttonHandlers.forEach(handler => handler(buttonName, true, false))
          }
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
            const buttonName = Object.entries(GAMEPAD_BUTTONS).find(([_, bi]) => bi === index)?.[0]
            if (buttonName) {
              const perfNow = performance.now()
              const lastBtnEmit = lastButtonEmitTime.get(buttonName) ?? 0
              if (perfNow - lastBtnEmit >= BUTTON_DEDUP_MS) {
                lastButtonEmitTime.set(buttonName, perfNow)
                buttonHandlers.forEach(handler => handler(buttonName, true, true))
              }
            }
            hold.lastEmit = now
            hold.repeating = true
          }
        }
      } else if (!isPressed) {
        buttonHoldState.delete(holdKey)
      }

      prevStates[index] = isPressed
    })

    previousButtonStates.set(gamepad.index, prevStates)
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

  const api = (window as any).electronAPI
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
      xboxRecoveryActive = false
      if (xboxRecoveryTimer) { clearTimeout(xboxRecoveryTimer); xboxRecoveryTimer = null }
      window.dispatchEvent(new CustomEvent('gamepad-reconnected'))
      api?.reportSteamConnected?.()
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

    // Detect Xbox ephemeral virtual: Steam controller that lived < 1s
    if (isSteamController(e.gamepad) && connectTime && (Date.now() - connectTime) < 1000) {
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
      console.log('[Gamepad] All gamepads lost – will restart in 3s if none reconnect')
      gamepadLossTimer = setTimeout(() => {
        if (!navigator.getGamepads().some(gp => gp !== null)) {
          console.log('[Gamepad] Restarting app to recover gamepad')
          restartAttempted = true
          emitToast('Reconnecting controller — restarting...', 'warning')
          setTimeout(() => window.electronAPI?.restartApp(), 2000)
        }
      }, 3000)
    }
  }

  window.addEventListener('gamepadconnected', handleConnect)
  window.addEventListener('gamepaddisconnected', handleDisconnect)

  return () => {
    clearInterval(startupProbe)
    if (initialSetupTimer) { clearTimeout(initialSetupTimer); initialSetupTimer = null }
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
  }
}

export function isGamepadConnected(): boolean {
  return filterGamepads([...navigator.getGamepads()]).length > 0
}
