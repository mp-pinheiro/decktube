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

let steamDisconnected = false

function filterGamepads(raw: (Gamepad | null)[]): Gamepad[] {
  const all: Gamepad[] = []
  const steam: Gamepad[] = []
  for (const gp of raw) {
    if (!gp) continue
    all.push(gp)
    if (isSteamController(gp)) steam.push(gp)
  }
  // When a Steam virtual controller disconnected, some physical devices
  // (e.g. Xbox) may lack virtual counterparts. Include raw devices.
  if (steamDisconnected && all.length > steam.length) return all
  return steam.length > 0 ? steam : all
}

let animationFrameId: number | null = null
let buttonHandlers: GamepadButtonHandler[] = []
const previousButtonStates = new Map<number, boolean[]>()

const lastTimestamps = new Map<number, number>()
const OVERLAY_WINDOW = 180 // ~3s at 60fps
let lastSteamActiveFrame = -OVERLAY_WINDOW
let overlaySuppressed = false
let frameCount = 0

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
  frameCount++

  // Overlay detection: when polling both Steam virtual and raw devices,
  // use the Steam virtual controller's timestamp as a canary.
  // Steam stops updating virtual controllers when the overlay is active.
  const steamPads = gamepads.filter(gp => isSteamController(gp))
  const rawPads = gamepads.filter(gp => !isSteamController(gp))

  if (steamPads.length > 0 && rawPads.length > 0) {
    let steamAdvanced = false
    for (const gp of steamPads) {
      const prevTs = lastTimestamps.get(gp.index)
      if (prevTs !== undefined && gp.timestamp !== prevTs) steamAdvanced = true
      lastTimestamps.set(gp.index, gp.timestamp)
    }
    if (steamAdvanced) lastSteamActiveFrame = frameCount

    const steamRecentlyActive = (frameCount - lastSteamActiveFrame) < OVERLAY_WINDOW
    const rawActive = rawPads.some(gp => gp.buttons.some(b => b.pressed))

    if (!steamAdvanced && steamRecentlyActive && rawActive && !overlaySuppressed) {
      overlaySuppressed = true
      previousButtonStates.clear()
      buttonHoldState.clear()
      console.log('[Gamepad] Steam virtual stalled with raw activity – suppressing (likely overlay)')
    }
    if (steamAdvanced && overlaySuppressed) {
      overlaySuppressed = false
      previousButtonStates.clear()
      buttonHoldState.clear()
      console.log('[Gamepad] Steam virtual resumed – unsuppressing')
    }
    if (overlaySuppressed) {
      animationFrameId = requestAnimationFrame(pollGamepads)
      return
    }
  } else {
    // Only Steam or only raw devices -- update timestamps, no overlay detection needed
    for (const gp of gamepads) lastTimestamps.set(gp.index, gp.timestamp)
    if (overlaySuppressed) {
      overlaySuppressed = false
      previousButtonStates.clear()
      buttonHoldState.clear()
    }
  }

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
  if (api?.onSystemGamepads) {
    api.onSystemGamepads((detected: boolean) => {
      systemGamepadsDetected = detected
      if (detected && filterGamepads([...navigator.getGamepads()]).length === 0) {
        console.log('[Gamepad] System gamepads detected but Gamepad API not yet active')
        window.dispatchEvent(new CustomEvent('gamepad-activation-needed'))
      }
    })
  }

  // NOTE: Chromium may not fire gamepadconnected for already-connected gamepads.
  // Probe and dispatch synthetic events so InputProvider's bootstrap fires.
  const knownIndices = new Set<number>()
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
    hadGamepads = true
    if (gamepadLossTimer) { clearTimeout(gamepadLossTimer); gamepadLossTimer = null }
    const isSteam = isSteamController(e.gamepad)
    console.log('[Gamepad] Connected:', e.gamepad.id, 'at index', e.gamepad.index, isSteam ? '(steam)' : '(raw hardware)')
    if (!isSteam) {
      console.log('[Gamepad] Non-Steam controller detected; will prefer Steam virtual gamepad if available')
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
    if (isSteamController(e.gamepad)) steamDisconnected = true
    console.log('[Gamepad] Disconnected:', e.gamepad.id, 'at index', e.gamepad.index)
    previousButtonStates.delete(e.gamepad.index)
    lastTimestamps.delete(e.gamepad.index)
    for (const key of buttonHoldState.keys()) {
      if (key.startsWith(`${e.gamepad.index}-`)) buttonHoldState.delete(key)
    }

    if (initialSetupDone && !isSteamController(e.gamepad)) {
      emitToast('Controller disconnected')
    }

    const remaining = navigator.getGamepads().some(gp => gp !== null)
    if (hadGamepads && !remaining && !restartAttempted) {
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
