import { lazy } from 'react'

export const routes = {
  home: '/',
  search: '/search',
  channel: '/channel/:channelId',
  watch: '/watch/:videoId',
  login: '/login',
} as const

export const HomePage = lazy(() => import('./pages/HomePage'))
export const SearchPage = lazy(() => import('./pages/SearchPage'))
export const ChannelPage = lazy(() => import('./pages/ChannelPage'))
export const WatchPage = lazy(() => import('./pages/WatchPage'))
export const LoginPage = lazy(() => import('./pages/LoginPage'))
