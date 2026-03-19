import { Link } from 'react-router-dom'
import type { YouTubeVideo } from '../lib/youtube'
import { formatDuration, formatViews, getThumbnailUrl } from '../lib/format'
import { recordHistory } from '../lib/historyStore'

interface VideoCardProps {
  video: YouTubeVideo
  showChannel?: boolean
  showDuration?: boolean
}

export default function VideoCard({ video, showChannel = true, showDuration = true }: VideoCardProps) {
  return (
    <Link
      to={`/watch/${video.videoId}`}
      data-video-id={video.videoId}
      data-channel-id={video.channelId}
      className="group cursor-pointer flex flex-col gap-2 outline-none focus:outline-none focus:ring-2 focus:ring-red-500 rounded-2xl min-h-0"
      onClick={() => recordHistory(video, 0, 0)}
    >
      <div className="relative flex-1 min-h-0 overflow-hidden rounded-2xl bg-zinc-800 border border-white/5 shadow-lg">
        {getThumbnailUrl(video) && (
          <img
            src={getThumbnailUrl(video)}
            alt={video.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        )}
        {showDuration && video.duration && video.duration > 0 && (
          <div className="absolute bottom-2 right-2 rounded-sm bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
            {formatDuration(video.duration)}
          </div>
        )}
      </div>

      <div className="flex-shrink-0 flex gap-3 px-1">
        <div className="flex flex-col gap-1 overflow-hidden">
          <h3 className="line-clamp-2 text-sm font-semibold text-zinc-100 leading-snug group-hover:text-blue-400 transition-colors">
            {video.title}
          </h3>
          <div className="flex flex-col text-xs text-zinc-400">
            {showChannel && <span>{video.channelName}</span>}
            <div className="flex items-center gap-1">
              <span>{video.viewCount ? formatViews(video.viewCount) : ''}</span>
              {video.publishedTimeText && (
                <>
                  <span className="text-[8px] opacity-50">•</span>
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
