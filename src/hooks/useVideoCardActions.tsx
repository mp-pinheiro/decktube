import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import ActionMenu, { type ActionMenuItem } from '../components/ActionMenu'
import { markWatched, markUnwatched, isWatched } from '../lib/watchedStore'
import { getFeedback, setFeedback, clearFeedback } from '../lib/feedbackStore'
import { forceBootstrapNavFocus } from '../lib/focusManager'
import type { ButtonAction } from '../contexts/InputContext'

interface UseVideoCardActionsOptions {
  onNavigate?: () => void
  getExtraItems?: () => ActionMenuItem[]
  onExtraAction?: (actionId: string, videoId: string) => void
  onChange?: () => void
}

type VideoCardActions = Partial<Record<ButtonAction, (isRepeat?: boolean) => void>>

export function useVideoCardActions(options: UseVideoCardActionsOptions = {}) {
  const { onNavigate, getExtraItems, onExtraAction, onChange } = options
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuVideoId, setMenuVideoId] = useState<string | null>(null)
  const [menuChannelId, setMenuChannelId] = useState('')

  const goToVideo = useCallback(() => {
    const link = document.activeElement?.closest('a[data-video-id]') as HTMLElement | null
    if (!link) return
    onNavigate?.()
    link.click()
  }, [onNavigate])

  const goToChannel = useCallback(() => {
    const card = document.activeElement?.closest('[data-video-id]')
    if (!card) return
    const channelId = card.getAttribute('data-channel-id')
    if (channelId) {
      onNavigate?.()
      navigate(`/channel/${channelId}`)
      return
    }
    const channelName = card.getAttribute('data-channel-name')?.trim()
    if (channelName) {
      onNavigate?.()
      navigate(`/search?q=${encodeURIComponent(channelName)}`)
    }
  }, [navigate, onNavigate])

  const openModeMenu = useCallback(() => {
    const card = document.activeElement?.closest('[data-video-id]') as HTMLElement | null
    const videoId = card?.getAttribute('data-video-id')
    if (!videoId) return
    setMenuVideoId(videoId)
    setMenuChannelId(card?.getAttribute('data-channel-id') ?? '')
    setMenuOpen(true)
  }, [])

  const closeMenu = useCallback(() => {
    setMenuOpen(false)
    setMenuVideoId(null)
    setMenuChannelId('')
    requestAnimationFrame(() => forceBootstrapNavFocus())
  }, [])

  const items = useMemo<ActionMenuItem[]>(() => {
    if (!menuVideoId) return []
    const watchedItem: ActionMenuItem = isWatched(menuVideoId)
      ? { id: 'mark-unwatched', label: 'Mark as unwatched' }
      : { id: 'mark-watched', label: 'Mark as watched' }
    const feedback = getFeedback(menuVideoId)
    const likeItem: ActionMenuItem = feedback === 'like'
      ? { id: 'clear-like', label: 'Remove like' }
      : { id: 'like', label: 'Like' }
    const dislikeItem: ActionMenuItem = feedback === 'dislike'
      ? { id: 'clear-dislike', label: 'Remove dislike' }
      : { id: 'dislike', label: 'Dislike' }
    return [likeItem, dislikeItem, watchedItem, ...(getExtraItems?.() ?? [])]
  }, [menuVideoId, getExtraItems])

  const handleMenuAction = useCallback((actionId: string) => {
    const videoId = menuVideoId
    if (videoId) {
      if (actionId === 'mark-watched') markWatched(videoId)
      else if (actionId === 'mark-unwatched') markUnwatched(videoId)
      else if (actionId === 'like') setFeedback(videoId, 'like', menuChannelId)
      else if (actionId === 'dislike') setFeedback(videoId, 'dislike', menuChannelId)
      else if (actionId === 'clear-like' || actionId === 'clear-dislike') clearFeedback(videoId)
      else onExtraAction?.(actionId, videoId)
    } else {
      onExtraAction?.(actionId, '')
    }
    closeMenu()
    onChange?.()
  }, [menuVideoId, menuChannelId, onExtraAction, onChange, closeMenu])

  const actions = useMemo<VideoCardActions>(() => ({
    select: goToVideo,
    channel: goToChannel,
    mode: openModeMenu,
  }), [goToVideo, goToChannel, openModeMenu])

  const menuElement = (
    <ActionMenu open={menuOpen} onClose={closeMenu} items={items} onSelect={handleMenuAction} />
  )

  return { actions, menuElement }
}
