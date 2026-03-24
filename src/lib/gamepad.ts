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

type GamepadButtonHandler = (button: string, pressed: boolean) => void

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

let wasFocused = true

function pollGamepads() {
  const isFocused = !document.hidden && document.hasFocus()

  if (!isFocused) {
    if (wasFocused) {
      previousButtonStates.clear()
      wasFocused = false
    }
    animationFrameId = requestAnimationFrame(pollGamepads)
    return
  }

  if (!wasFocused) {
    previousButtonStates.clear()
    wasFocused = true
  }

  const gamepads = filterGamepads([...navigator.getGamepads()])

  for (const gamepad of gamepads) {
    const prevStates = previousButtonStates.get(gamepad.index) ?? []

    gamepad.buttons.forEach((button, index) => {
      const isPressed = button.pressed
      const wasPressed = prevStates[index] || false

      if (isPressed && !wasPressed) {
        const buttonName = Object.entries(GAMEPAD_BUTTONS).find(([_, bi]) => bi === index)?.[0]
        if (buttonName) {
          buttonHandlers.forEach(handler => handler(buttonName, true))
        }
      }

      prevStates[index] = isPressed
    })

    previousButtonStates.set(gamepad.index, prevStates)
  }

  animationFrameId = requestAnimationFrame(pollGamepads)
}

export function initGamepad(handler: GamepadButtonHandler) {
  buttonHandlers.push(handler)

  if (!animationFrameId) {
    animationFrameId = requestAnimationFrame(pollGamepads)
  }

  const handleConnect = (e: GamepadEvent) => {
    const isSteam = isSteamController(e.gamepad)
    console.log('[Gamepad] Connected:', e.gamepad.id, 'at index', e.gamepad.index, isSteam ? '(steam)' : '(raw hardware)')
    if (!isSteam) {
      console.log('[Gamepad] Non-Steam controller detected; will prefer Steam virtual gamepad if available')
    }
  }

  const handleDisconnect = (e: GamepadEvent) => {
    console.log('[Gamepad] Disconnected:', e.gamepad.id, 'at index', e.gamepad.index)
    previousButtonStates.delete(e.gamepad.index)
  }

  window.addEventListener('gamepadconnected', handleConnect)
  window.addEventListener('gamepaddisconnected', handleDisconnect)

  return () => {
    buttonHandlers = buttonHandlers.filter(h => h !== handler)
    if (buttonHandlers.length === 0 && animationFrameId) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
      previousButtonStates.clear()
    }
    window.removeEventListener('gamepadconnected', handleConnect)
    window.removeEventListener('gamepaddisconnected', handleDisconnect)
  }
}

export function isGamepadConnected(): boolean {
  return filterGamepads([...navigator.getGamepads()]).length > 0
}
