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

let animationFrameId: number | null = null
let buttonHandlers: GamepadButtonHandler[] = []
const previousButtonStates = new Map<number, boolean[]>()
let appFocused = true
let wasFocused = true

export function setAppFocused(focused: boolean) {
  appFocused = focused
}

function pollGamepads() {
  const isFocused = !document.hidden && document.hasFocus() && appFocused

  if (!isFocused) {
    if (wasFocused) {
      previousButtonStates.clear()
      wasFocused = false
    }
    animationFrameId = requestAnimationFrame(pollGamepads)
    return
  }

  wasFocused = true

  const gamepads = navigator.getGamepads()

  for (let i = 0; i < gamepads.length; i++) {
    const gamepad = gamepads[i]
    if (!gamepad) continue

    const prevStates = previousButtonStates.get(i) ?? []

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

    previousButtonStates.set(i, prevStates)
  }

  animationFrameId = requestAnimationFrame(pollGamepads)
}

export function initGamepad(handler: GamepadButtonHandler) {
  buttonHandlers.push(handler)

  if (!animationFrameId) {
    animationFrameId = requestAnimationFrame(pollGamepads)
  }

  const handleConnect = (e: GamepadEvent) => {
    console.log('[Gamepad] Connected:', e.gamepad.id, 'at index', e.gamepad.index)
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
  return navigator.getGamepads().some(gp => gp !== null)
}
