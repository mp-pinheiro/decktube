export type InputIntent =
  | 'select'
  | 'back'
  | 'channel'
  | 'search'
  | 'play'
  | 'fullscreen'
  | 'quality'
  | 'next'
  | 'prevTab'
  | 'nextTab'
  | 'mode'
  | 'help'
  | 'nav_up'
  | 'nav_down'
  | 'nav_left'
  | 'nav_right'

const KEYBOARD_MAP: Record<string, InputIntent> = {
  enter: 'select',
  escape: 'back',
  c: 'channel',
  s: 'search',
  ' ': 'play',
  f: 'fullscreen',
  q: 'quality',
  n: 'next',
  '[': 'prevTab',
  ']': 'nextTab',
  m: 'mode',
  h: 'help',
  arrowup: 'nav_up',
  arrowdown: 'nav_down',
  arrowleft: 'nav_left',
  arrowright: 'nav_right',
}

const GAMEPAD_MAP: Record<string, InputIntent> = {
  A: 'select',
  B: 'back',
  X: 'channel',
  Y: 'search',
  LB: 'fullscreen',
  RB: 'nextTab',
  LT: 'quality',
  START: 'mode',
  SELECT: 'help',
  DPAD_UP: 'nav_up',
  DPAD_DOWN: 'nav_down',
  DPAD_LEFT: 'nav_left',
  DPAD_RIGHT: 'nav_right',
}

export function keyToIntent(key: string): InputIntent | null {
  return KEYBOARD_MAP[key.toLowerCase()] ?? null
}

export function gamepadToIntent(button: string): InputIntent | null {
  return GAMEPAD_MAP[button] ?? null
}
