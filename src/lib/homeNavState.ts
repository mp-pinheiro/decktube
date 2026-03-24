import type { YouTubeVideo } from './youtube'

export interface CachedTabData {
  videos: YouTubeVideo[]
  continuation: string | null
}

export interface HomeNavState {
  activeTab: string
  pageIndex: number
  focusIndex: number
  tabs: Record<string, CachedTabData>
}

let cached: HomeNavState | null = null

export function saveHomeNavState(state: HomeNavState): void {
  cached = state
}

export function consumeHomeNavState(): HomeNavState | null {
  const state = cached
  cached = null
  return state
}
