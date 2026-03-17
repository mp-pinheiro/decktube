const API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8'

import { getToken } from './oauth'

const CLIENT_CONFIG = {
  clientName: 'WEB',
  clientVersion: '2.20250925.01.00',
  hl: 'en',
  gl: 'US',
} as const

const TV_CLIENT_CONFIG = {
  clientName: 'TVHTML5',
  clientVersion: '7.20250923.13.00',
  deviceMake: 'Samsung',
  deviceModel: 'SmartTV',
  osName: 'Tizen',
  osVersion: '4.0.0.2',
  platform: 'TV',
  hl: 'en',
  gl: 'US',
} as const

const IOS_PLAYER_CONFIG = {
  clientName: 'IOS',
  clientVersion: '20.20.7',
  deviceMake: 'Apple',
  deviceModel: 'iPhone16,2',
  osName: 'iOS',
  osVersion: '18.5.0.22F76',
  platform: 'MOBILE',
  hl: 'en',
  gl: 'US',
} as const

const IOS_USER_AGENT = 'com.google.ios.youtube/20.20.7 (iPhone16,2; U; CPU iOS 18_5_0 like Mac OS X)'

type Context = {
  client: typeof CLIENT_CONFIG | typeof TV_CLIENT_CONFIG
}

interface YouTubeiRequest {
  context: Context
  [key: string]: unknown
}

type RunsText = { runs: Array<{ text: string }> }
type SimpleText = { simpleText: string }
type TextObj = RunsText | SimpleText

function extractText(textObj: TextObj | undefined): string {
  if (!textObj) return ''
  if ('simpleText' in textObj) return textObj.simpleText
  if ('runs' in textObj) return textObj.runs.map(r => r.text).join('')
  return ''
}

type ThumbnailData = { url: string; width: number; height: number }

export interface YouTubeThumbnail {
  url: string
  width: number
  height: number
}

export interface YouTubeVideo {
  videoId: string
  title: string
  thumbnails: YouTubeThumbnail[]
  channelName: string
  channelId: string
  duration?: number
  viewCount?: number
  publishedTimeText?: string
  description?: string
}

export interface YouTubeSearchResult extends YouTubeVideo {
  type: 'video' | 'channel' | 'playlist'
}

interface VideoRenderer {
  videoId: string
  title: TextObj
  thumbnail: { thumbnails: ThumbnailData[] }
  lengthText?: TextObj
  shortBylineText?: { runs: Array<{ text: string; navigationEndpoint?: { browseEndpoint?: { browseId: string } } }> }
  ownerText?: { runs: Array<{ text: string; navigationEndpoint?: { browseEndpoint?: { browseId: string } } }> }
  publishedTimeText?: { simpleText: string }
  viewCountText?: TextObj
  descriptionSnippet?: { runs: Array<{ text: string }> }
  longBylineText?: { runs: Array<{ text: string; navigationEndpoint?: { browseEndpoint?: { browseId: string } } }> }
}

interface CompactVideoRenderer {
  videoId: string
  title: TextObj
  thumbnail: { thumbnails: ThumbnailData[] }
  lengthText?: TextObj
  shortBylineText?: { runs: Array<{ text: string; navigationEndpoint?: { browseEndpoint?: { browseId: string } } }> }
  publishedTimeText?: { simpleText: string }
  viewCountText?: TextObj
}

function parseDuration(durationText: string): number {
  const parts = durationText.split(':').map(Number)
  if (parts.length === 3) {
    const [hours, mins, secs] = parts
    return hours * 3600 + mins * 60 + secs
  }
  if (parts.length === 2) {
    const [mins, secs] = parts
    return mins * 60 + secs
  }
  return 0
}

function parseViewCount(viewText: string): number {
  const match = viewText.match(/[\d.,]+/g)
  if (!match) return 0

  const num = parseFloat(match[0].replace(/,/g, ''))

  if (viewText.toLowerCase().includes('b')) {
    return Math.round(num * 1000000000)
  }
  if (viewText.toLowerCase().includes('m')) {
    return Math.round(num * 1000000)
  }
  if (viewText.toLowerCase().includes('k')) {
    return Math.round(num * 1000)
  }
  if (viewText.toLowerCase().includes('watching')) {
    return Math.round(num)
  }

  return Math.round(num)
}

function extractChannelId(
  runs: Array<{ navigationEndpoint?: { browseEndpoint?: { browseId: string } } }> | undefined
): string {
  if (!runs) return ''
  for (const run of runs) {
    const browseId = run.navigationEndpoint?.browseEndpoint?.browseId
    if (browseId && browseId.startsWith('UC')) return browseId
  }
  return ''
}

function parseVideoRenderer(renderer: VideoRenderer | CompactVideoRenderer | undefined): YouTubeVideo | null {
  if (!renderer || !renderer.videoId) return null

  const title = extractText(renderer.title)
  const thumbnails = (renderer.thumbnail?.thumbnails || []).map(t => ({
    url: t.url,
    width: t.width,
    height: t.height,
  }))

  const shortBylineText = 'shortBylineText' in renderer ? renderer.shortBylineText : undefined
  const ownerText = 'ownerText' in renderer ? renderer.ownerText : undefined
  const longBylineText = 'longBylineText' in renderer ? renderer.longBylineText : undefined

  const channelName = extractText(shortBylineText || ownerText || longBylineText || undefined)
  const channelId = extractChannelId(
    shortBylineText?.runs || ownerText?.runs || longBylineText?.runs
  )

  const durationText = extractText(renderer.lengthText || undefined)
  const duration = durationText ? parseDuration(durationText) : undefined

  const viewCountText = extractText(renderer.viewCountText || undefined)
  const viewCount = viewCountText ? parseViewCount(viewCountText) : undefined

  const publishedTimeText =
    'publishedTimeText' in renderer && renderer.publishedTimeText
      ? renderer.publishedTimeText.simpleText
      : undefined

  const description =
    'descriptionSnippet' in renderer && renderer.descriptionSnippet
      ? extractText(renderer.descriptionSnippet)
      : undefined

  if (!title) return null

  return {
    videoId: renderer.videoId,
    title,
    thumbnails,
    channelName,
    channelId,
    duration,
    viewCount,
    publishedTimeText,
    description,
  }
}

function extractVideosFromRenderers(data: unknown): YouTubeVideo[] {
  const videos: YouTubeVideo[] = []

  function walk(current: unknown) {
    if (Array.isArray(current)) {
      for (const item of current) {
        walk(item)
      }
      return
    }

    if (typeof current !== 'object' || current === null) {
      return
    }

    const item = current as Record<string, unknown>

    if ('videoRenderer' in item) {
      const video = parseVideoRenderer(item.videoRenderer as VideoRenderer)
      if (video) videos.push(video)
    } else if ('compactVideoRenderer' in item) {
      const video = parseVideoRenderer(item.compactVideoRenderer as CompactVideoRenderer)
      if (video) videos.push(video)
    } else if ('gridVideoRenderer' in item) {
      const video = parseVideoRenderer(item.gridVideoRenderer as VideoRenderer)
      if (video) videos.push(video)
    } else if ('lockupViewModel' in item) {
      const lockup = (item as { lockupViewModel: { contentId?: string; thumbnail?: unknown; metadata?: unknown } }).lockupViewModel
      if (lockup.contentId?.startsWith('video:')) {
        const videoId = lockup.contentId.replace('video:', '')
        const thumbnail = lockup.thumbnail as { thumbnailViewModel?: { image?: { sources?: Array<{ url?: string }> } } }
        const metadata = lockup.metadata as { contentMetadataViewModel?: { title?: { content?: string }; subtitle?: unknown } }

        const title = metadata?.contentMetadataViewModel?.title?.content || ''
        const thumbnailUrl = thumbnail?.thumbnailViewModel?.image?.sources?.[0]?.url || ''

        let channelName = ''
        let channelId = ''
        const subtitle = metadata?.contentMetadataViewModel?.subtitle as any
        if (subtitle && typeof subtitle === 'object' && subtitle.runs) {
          channelName = subtitle.runs.map((r: any) => r.text).join('')
          for (const run of subtitle.runs) {
            const browseId = run.onTap?.innertubeCommand?.browseEndpoint?.browseId
                          || run.navigationEndpoint?.browseEndpoint?.browseId
            if (browseId && browseId.startsWith('UC')) {
              channelId = browseId
              break
            }
          }
        } else if (typeof subtitle === 'string') {
          channelName = subtitle.split('•')[0]?.trim() || ''
        }

        if (videoId && title) {
          videos.push({
            videoId,
            title,
            thumbnails: thumbnailUrl ? [{ url: thumbnailUrl, width: 320, height: 180 }] : [],
            channelName,
            channelId,
          })
        }
      }
    } else if ('tileRenderer' in item) {
      const tile = item.tileRenderer as any
      const videoId = tile.onSelectCommand?.watchEndpoint?.videoId
      
      if (videoId) {
        const titleText = extractText(tile.metadata?.tileMetadataRenderer?.title)
        let thumbnails: YouTubeThumbnail[] = []
        if (tile.header?.tileHeaderRenderer?.thumbnail?.thumbnails) {
          thumbnails = tile.header.tileHeaderRenderer.thumbnail.thumbnails.map((t: any) => ({
             url: t.url, width: t.width, height: t.height
          }))
        }
        
        const lines = tile.metadata?.tileMetadataRenderer?.lines || []
        let channelName = ''
        let viewCountText = ''
        
        for (const line of lines) {
          const items = line.lineRenderer?.items || []
          for (const lineItem of items) {
            const text = extractText(lineItem.lineItemRenderer?.text)
            if (!channelName) { channelName = text }
            else if (text.includes('views') || text.includes('watching')) { viewCountText = text }
          }
        }
        let channelId = ''
        const menuItems = tile.onLongPressCommand?.showMenuCommand?.menu?.menuRenderer?.items || []
        for (const menuItem of menuItems) {
          const navItem = menuItem.menuNavigationItemRenderer
          const browseId = navItem?.navigationEndpoint?.browseEndpoint?.browseId
          if (browseId && browseId.startsWith('UC')) {
            channelId = browseId
            break
          }
        }

        videos.push({
          videoId,
          title: titleText,
          thumbnails,
          channelName,
          channelId,
          viewCount: viewCountText ? parseViewCount(viewCountText) : undefined,
        })
      }
    } else {
      for (const key in item) {
        if (typeof item[key] === 'object' && item[key] !== null) {
          walk(item[key])
        }
      }
    }
  }

  walk(data)

  const seen = new Set<string>()
  return videos.filter(v => {
    if (seen.has(v.videoId)) return false
    seen.add(v.videoId)
    return true
  })
}

function extractContinuationToken(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null

  const tokens: string[] = []

  function walk(current: unknown) {
    if (Array.isArray(current)) {
      for (const item of current) walk(item)
      return
    }
    if (typeof current !== 'object' || current === null) return
    const obj = current as Record<string, unknown>

    if ('continuationItemRenderer' in obj) {
      const renderer = obj.continuationItemRenderer as Record<string, unknown>
      const endpoint = renderer.continuationEndpoint as Record<string, unknown> | undefined
      if (endpoint) {
        const cmd = endpoint.continuationCommand as { token?: string } | undefined
        if (cmd?.token) {
          tokens.push(cmd.token)
          return
        }
      }
      if (typeof renderer.token === 'string') {
        tokens.push(renderer.token)
        return
      }
    }

    if ('nextContinuationData' in obj) {
      const nextCont = obj.nextContinuationData as Record<string, unknown>
      if (typeof nextCont.continuation === 'string') {
        tokens.push(nextCont.continuation)
        return
      }
    }

    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        walk(obj[key])
      }
    }
  }

  walk(data)
  return tokens.length > 0 ? tokens[tokens.length - 1] : null
}

async function youtubeiRequest<T>(endpoint: string, body: YouTubeiRequest, useTvClient = false): Promise<T> {
  const token = await getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`/youtubei/v1/${endpoint}?key=${API_KEY}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...body,
      context: {
        ...body.context,
        client: useTvClient ? TV_CLIENT_CONFIG : CLIENT_CONFIG,
      },
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error')
    throw new Error(`YouTube API error: ${response.status} ${response.statusText} - ${text}`)
  }

  return response.json()
}

export interface HomeFeedResult {
  videos: YouTubeVideo[]
  continuation: string | null
}

export async function getHomeFeed(): Promise<HomeFeedResult> {
  const token = await getToken()
  if (!token) return { videos: [], continuation: null }

  try {
    const response = await youtubeiRequest('browse', {
      context: { client: TV_CLIENT_CONFIG },
      browseId: 'FEwhat_to_watch',
    }, true)

    const videos = extractVideosFromRenderers(response).map(v => ({ ...v, type: 'video' as const }))
    const continuation = extractContinuationToken(response)
    return { videos, continuation }
  } catch (error) {
    console.error('Error fetching home feed:', error)
    return { videos: [], continuation: null }
  }
}

export async function getHomeFeedContinuation(continuationToken: string): Promise<HomeFeedResult> {
  const token = await getToken()
  if (!token) return { videos: [], continuation: null }

  try {
    const response = await youtubeiRequest('browse', {
      context: { client: TV_CLIENT_CONFIG },
      continuation: continuationToken,
    }, true)

    const videos = extractVideosFromRenderers(response).map(v => ({ ...v, type: 'video' as const }))
    const continuation = extractContinuationToken(response)
    return { videos, continuation }
  } catch (error) {
    console.error('Error fetching home feed continuation:', error)
    return { videos: [], continuation: null }
  }
}

export async function getVideoDetails(videoId: string): Promise<YouTubeVideo | null> {
  try {
    const response = (await youtubeiRequest('next', {
      context: { client: TV_CLIENT_CONFIG },
      videoId,
    }, true)) as Record<string, unknown>

    const webResults = (response.contents as any)?.twoColumnWatchNextResults?.results?.results?.contents || []
    const tvResults = (response.contents as any)?.singleColumnWatchNextResults?.results?.results?.contents || []
    const results = [...webResults, ...tvResults]

    let title = ''
    let channelName = ''
    let channelId = ''
    let description = ''
    let viewCount: number | undefined
    let publishedTimeText = ''

    for (const result of results) {
      if ('videoPrimaryInfoRenderer' in result) {
        const primary = result.videoPrimaryInfoRenderer as any
        title = extractText(primary.title)
        
        const viewCountStr = extractText(primary.viewCount?.videoViewCountRenderer?.viewCount) 
                          || extractText(primary.viewCount?.videoViewCountRenderer?.shortViewCount)
        if (viewCountStr) {
          viewCount = parseViewCount(viewCountStr)
        }
        
        publishedTimeText = extractText(primary.relativeDateText) || extractText(primary.dateText)
      }
      if ('videoSecondaryInfoRenderer' in result) {
        const owner = (result.videoSecondaryInfoRenderer as any)?.owner?.videoOwnerRenderer
        channelName = extractText(owner?.title)
        channelId = owner?.navigationEndpoint?.browseEndpoint?.browseId || ''
        description = extractText((result.videoSecondaryInfoRenderer as any)?.description)
      }
      if ('itemSectionRenderer' in result) {
         const items = (result.itemSectionRenderer as any)?.contents || []
         for (const item of items) {
           if ('videoMetadataRenderer' in item) {
             const meta = item.videoMetadataRenderer as any
             if (meta.title) title = extractText(meta.title)
             const pDate = extractText(meta.dateText) || extractText(meta.publishedTimeText)
             if (pDate) publishedTimeText = pDate
             
             const vCount = extractText(meta.viewCount?.videoViewCountRenderer?.viewCount) 
                         || extractText(meta.viewCount?.videoViewCountRenderer?.shortViewCount)
                         
             if (vCount) viewCount = parseViewCount(vCount)
             
             const owner = meta.owner?.videoOwnerRenderer
             if (owner) {
                channelName = extractText(owner?.title)
                channelId = owner?.navigationEndpoint?.browseEndpoint?.browseId || ''
             }
             if (meta.description) description = extractText(meta.description)
           }
         }
      }
    }

    return {
      videoId,
      title,
      thumbnails: [],
      channelName,
      channelId,
      description,
      viewCount,
      publishedTimeText,
    }
  } catch (error) {
    console.error('Error fetching video details:', error)
    return null
  }
}

export async function getRelatedVideos(videoId: string): Promise<YouTubeVideo[]> {
  try {
    const response = (await youtubeiRequest('next', {
      context: { client: TV_CLIENT_CONFIG },
      videoId,
    }, true)) as Record<string, unknown>

    const videos = extractVideosFromRenderers(response)
    return videos.filter(v => v.videoId !== videoId)
  } catch (error) {
    console.error('Error fetching related videos:', error)
    return []
  }
}

export async function search(query: string): Promise<YouTubeSearchResult[]> {
  const response = (await youtubeiRequest('search', {
    context: { client: TV_CLIENT_CONFIG },
    query,
  }, true)) as Record<string, unknown>

  const videos = extractVideosFromRenderers(response)
  return videos.map(v => ({ ...v, type: 'video' as const }))
}

export interface AdaptiveFormat {
  itag: number
  url: string
  mimeType: string
  bitrate: number
  width?: number
  height?: number
  qualityLabel?: string
  contentLength?: string
  approxDurationMs?: string
  indexRange?: { start: string; end: string }
  initRange?: { start: string; end: string }
}

export interface PlayerData {
  adaptiveFormats: AdaptiveFormat[]
}

export async function getPlayerData(videoId: string): Promise<PlayerData> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-YouTube-Client-Name': '5',
    'X-YouTube-Client-Version': IOS_PLAYER_CONFIG.clientVersion,
    'X-YouTube-Player-User-Agent': IOS_USER_AGENT,
  }

  const body = {
    context: { client: IOS_PLAYER_CONFIG },
    videoId,
    contentCheckOk: true,
    racyCheckOk: true,
    params: '2AMB',
  }

  const response = await fetch('/youtubei/v1/player?prettyPrint=false', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error')
    throw new Error(`YouTube API error: ${response.status} ${response.statusText} - ${text}`)
  }

  const data = (await response.json()) as Record<string, unknown>

  const playability = data.playabilityStatus as { status?: string; reason?: string } | undefined
  if (playability?.status && playability.status !== 'OK') {
    throw new Error(playability.reason || `Video is ${playability.status.toLowerCase()}`)
  }

  const streamingData = data.streamingData as Record<string, unknown> | undefined
  const rawFormats = (streamingData?.adaptiveFormats as any[]) || []
  const adaptiveFormats: AdaptiveFormat[] = rawFormats
    .filter((f: any) => f.url)
    .filter((f: any) => !f.audioTrack || f.audioTrack.audioIsDefault !== false)
    .map((f: any) => ({
      itag: f.itag,
      url: f.url,
      mimeType: f.mimeType || '',
      bitrate: f.bitrate || 0,
      width: f.width,
      height: f.height,
      qualityLabel: f.qualityLabel,
      contentLength: f.contentLength,
      approxDurationMs: f.approxDurationMs,
      indexRange: f.indexRange,
      initRange: f.initRange,
    }))

  return { adaptiveFormats }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function formatIsoDuration(ms: number): string {
  const totalSeconds = ms / 1000
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = (totalSeconds % 60).toFixed(3)
  let dur = 'PT'
  if (h > 0) dur += `${h}H`
  if (m > 0) dur += `${m}M`
  dur += `${s}S`
  return dur
}

export function generateMpd(formats: AdaptiveFormat[]): string {
  const groups = new Map<string, AdaptiveFormat[]>()
  for (const f of formats) {
    if (!f.url) continue
    if (!f.indexRange || !f.initRange) continue
    const baseMime = f.mimeType.split(';')[0].trim()
    if (!groups.has(baseMime)) groups.set(baseMime, [])
    groups.get(baseMime)!.push(f)
  }

  let maxDurationMs = 0
  for (const f of formats) {
    if (f.approxDurationMs) {
      const d = parseInt(f.approxDurationMs, 10)
      if (d > maxDurationMs) maxDurationMs = d
    }
  }
  const durationAttr = maxDurationMs > 0 ? ` mediaPresentationDuration="${formatIsoDuration(maxDurationMs)}"` : ''

  let adaptationSets = ''
  for (const [mime, fmts] of groups) {
    const isVideo = mime.startsWith('video/')
    let representations = ''
    for (const f of fmts) {
      const codecMatch = f.mimeType.match(/codecs="([^"]+)"/)
      const codecs = codecMatch ? codecMatch[1] : ''
      let segmentBase = ''
      if (f.indexRange && f.initRange) {
        segmentBase = `<SegmentBase indexRange="${f.indexRange.start}-${f.indexRange.end}">` +
          `<Initialization range="${f.initRange.start}-${f.initRange.end}"/>` +
          `</SegmentBase>`
      }
      representations += `<Representation id="${f.itag}" bandwidth="${f.bitrate}"` +
        `${isVideo ? ` width="${f.width || 0}" height="${f.height || 0}"` : ''}` +
        ` codecs="${codecs}">` +
        `<BaseURL>${escapeXml(f.url)}</BaseURL>` +
        `${segmentBase}</Representation>`
    }
    adaptationSets += `<AdaptationSet mimeType="${mime}" subsegmentAlignment="true">` +
      `${representations}</AdaptationSet>`
  }

  const mpd = `<?xml version="1.0" encoding="UTF-8"?>` +
    `<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static" minBufferTime="PT1.5S"` +
    `${durationAttr}` +
    ` profiles="urn:mpeg:dash:profile:isoff-on-demand:2011">` +
    `<Period>${adaptationSets}</Period></MPD>`

  return mpd
}

export async function getChannelVideos(channelId: string): Promise<YouTubeVideo[]> {
  try {
    const response = (await youtubeiRequest('browse', {
      context: { client: TV_CLIENT_CONFIG },
      browseId: channelId,
    }, true)) as Record<string, unknown>

    const videos = extractVideosFromRenderers(response)
    return videos.map(v => ({ ...v, type: 'video' as const }))
  } catch (error) {
    console.error('Error fetching channel videos:', error)
    return []
  }
}
