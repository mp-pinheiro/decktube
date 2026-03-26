import { useState, useEffect, useRef } from 'react'
import type { MediaPlayerClass } from 'dashjs'
import PlayPauseIndicator from './overlay/PlayPauseIndicator'
import SeekIndicator from './overlay/SeekIndicator'
import VolumeIndicator from './overlay/VolumeIndicator'
import QualityIndicator from './overlay/QualityIndicator'
import SponsorSkipIndicator from './overlay/SponsorSkipIndicator'
import type { SponsorSegment } from '../lib/sponsorblock'

export function useAutoFade(trigger: number, durationMs: number): boolean {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (trigger === 0) return
    setVisible(true)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setVisible(false), durationMs)
    return () => clearTimeout(timerRef.current)
  }, [trigger, durationMs])

  return visible
}

interface PlayerOverlayProps {
  playAction: number
  paused: boolean
  seekAction: number
  seekDelta: number
  volumeAction: number
  volume: number
  qualityAction: number
  qualityLabel: string
  sponsorSkipAction: number
  sponsorSkipLabel: string
  sponsorSegments: SponsorSegment[]
  videoEl: HTMLVideoElement | null
  dashPlayer: MediaPlayerClass | null
}

export default function PlayerOverlay({
  playAction,
  paused,
  seekAction,
  seekDelta,
  volumeAction,
  volume,
  qualityAction,
  qualityLabel,
  sponsorSkipAction,
  sponsorSkipLabel,
  sponsorSegments,
  videoEl,
  dashPlayer,
}: PlayerOverlayProps) {
  return (
    <div className="absolute inset-0 z-20 pointer-events-none">
      <PlayPauseIndicator trigger={playAction} paused={paused} />
      <VolumeIndicator trigger={volumeAction} volume={volume} paused={paused} />
      <SeekIndicator trigger={seekAction} seekDelta={seekDelta} videoEl={videoEl} dashPlayer={dashPlayer} paused={paused} segments={sponsorSegments} />
      <QualityIndicator trigger={qualityAction} label={qualityLabel} paused={paused} />
      <SponsorSkipIndicator trigger={sponsorSkipAction} label={sponsorSkipLabel} paused={paused} />
    </div>
  )
}
