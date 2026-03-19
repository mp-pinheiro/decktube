import type { InputIntent } from './inputMap'

export type InputInterceptor = (intent: InputIntent, event?: KeyboardEvent) => boolean

const layerStack: { id: string; handler: InputInterceptor }[] = []

export function pushInputLayer(id: string, handler: InputInterceptor): () => void {
  const entry = { id, handler }
  layerStack.push(entry)
  return () => {
    const idx = layerStack.indexOf(entry)
    if (idx !== -1) layerStack.splice(idx, 1)
  }
}

export function dispatchThroughLayers(intent: InputIntent, event?: KeyboardEvent): boolean {
  for (let i = layerStack.length - 1; i >= 0; i--) {
    if (layerStack[i].handler(intent, event)) return true
  }
  return false
}
