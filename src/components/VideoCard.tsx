import { Link } from 'react-router-dom'
import type { YouTubeVideo } from '../lib/youtube'
import { formatDuration, formatViews, getThumbnailUrl } from '../lib/format'
import { recordHistory } from '../lib/historyStore'
import { getPlaybackPosition } from '../lib/playbackStore'
import { isWatched } from '../lib/watchedStore'

interface VideoCardProps {
  video: YouTubeVideo
  showChannel?: boolean
  showDuration?: boolean
  showWatchedBadge?: boolean
}

export default function VideoCard({ video, showChannel = true, showDuration = true, showWatchedBadge = false }: VideoCardProps) {
  const position = getPlaybackPosition(video.videoId)
  const progress = position && video.duration ? position / video.duration : 0
  const watched = showWatchedBadge && isWatched(video.videoId)

  return (
    <Link
      to={`/watch/${video.videoId}`}
      data-video-id={video.videoId}
      data-channel-id={video.channelId}
      className={`group cursor-pointer flex flex-col gap-1 outline-none focus:outline-none focus:ring-2 focus:ring-red-500 rounded-2xl min-h-0${watched ? ' opacity-60' : ''}`}
      onClick={() => recordHistory(video, 0, video.duration || 0)}
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-zinc-800 border border-white/5 shadow-lg">
        {getThumbnailUrl(video) && (
          <img
            src={getThumbnailUrl(video)}
            alt={video.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        )}
        {watched && (
          <div className="absolute top-2 left-2 rounded-sm bg-black/80 px-1.5 py-0.5 text-xs font-bold text-zinc-300 backdrop-blur-sm flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
            </svg>
            Watched
          </div>
        )}
        {showDuration && video.duration && video.duration > 0 && (
          <div className="absolute bottom-2 right-2 rounded-sm bg-black/80 px-1.5 py-0.5 text-sm font-bold text-white backdrop-blur-sm">
            {formatDuration(video.duration)}
          </div>
        )}
        {progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div className="h-full bg-red-600" style={{ width: `${progress * 100}%` }} />
          </div>
        )}
      </div>

      <div className="flex-shrink-0 flex gap-2 px-1 pt-0.5">
        <div className="flex flex-col gap-0.5 overflow-hidden">
          <h3 className="line-clamp-2 text-base font-semibold text-zinc-100 leading-snug group-hover:text-blue-400 transition-colors">
            {video.title}
          </h3>
          <div className="flex flex-col text-sm text-zinc-400">
            {showChannel && <span>{video.channelName}</span>}
            <div className="flex items-center gap-1">
              <span>{video.viewCount ? formatViews(video.viewCount) : ''}</span>
              {video.publishedTimeText && (
                <>
                  <span className="text-xs opacity-50">•</span>
                  <span>{video.publishedTimeText}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
