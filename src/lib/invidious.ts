export interface InvidiousVideo {
  videoId: string
  title: string
  videoThumbnails: { url: string; width: number; height: number; quality: string }[]
  author: string
  authorId: string
  lengthSeconds: number
  viewCount: number
  published: number
}

export interface InvidiousTrendingResponse {
  type?: string
  videos?: InvidiousVideo[]
}

const MOCK_VIDEOS: InvidiousVideo[] = [
  {
    videoId: 'XsaEmJXg2EU',
    title: 'Lofi Hip Hop Radio - Beats to Relax/Study to',
    videoThumbnails: [
      { url: 'https://i.ytimg.com/vi/XsaEmJXg2EU/mqdefault.jpg', width: 320, height: 180, quality: 'medium' },
    ],
    author: 'Lofi Girl',
    authorId: 'UCSJ4gkVC6NrvII8umztf0Ow',
    lengthSeconds: 0,
    viewCount: 73000000,
    published: 1704067200,
  },
  {
    videoId: 'jfKfPfyJRdk',
    title: 'synthwave radio - beats to relax/game to',
    videoThumbnails: [
      { url: 'https://i.ytimg.com/vi/jfKfPfyJRdk/mqdefault.jpg', width: 320, height: 180, quality: 'medium' },
    ],
    author: 'Lofi Girl',
    authorId: 'UCSJ4gkVC6NrvII8umztf0Ow',
    lengthSeconds: 0,
    viewCount: 42000000,
    published: 1704067200,
  },
  {
    videoId: '4xDzrJKXOOY',
    title: 'Relaxing Jazz Music - Background Jazz for Working',
    videoThumbnails: [
      { url: 'https://i.ytimg.com/vi/4xDzrJKXOOY/mqdefault.jpg', width: 320, height: 180, quality: 'medium' },
    ],
    author: 'BGM Channel',
    authorId: 'UC7viBPC5RbLIYYxztlTVAqA',
    lengthSeconds: 36000,
    viewCount: 12000000,
    published: 1704067200,
  },
  {
    videoId: 'Dx5qFachd3A',
    title: 'Beautiful Piano Music - Relaxing Music for Study',
    videoThumbnails: [
      { url: 'https://i.ytimg.com/vi/Dx5qFachd3A/mqdefault.jpg', width: 320, height: 180, quality: 'medium' },
    ],
    author: 'Soothing Relaxation',
    authorId: 'UCjx9M8P6i0qy0kf9NxKqTqg',
    lengthSeconds: 10800,
    viewCount: 45000000,
    published: 1704067200,
  },
  {
    videoId: '5qap5aO4i9A',
    title: 'lofi hip hop radio - beats to relax/study to',
    videoThumbnails: [
      { url: 'https://i.ytimg.com/vi/5qap5aO4i9A/mqdefault.jpg', width: 320, height: 180, quality: 'medium' },
    ],
    author: 'Lofi Girl',
    authorId: 'UCSJ4gkVC6NrvII8umztf0Ow',
    lengthSeconds: 0,
    viewCount: 70000000,
    published: 1704067200,
  },
  {
    videoId: 'hNTMJtQMBmI',
    title: 'Minecraft but it\'s relaxing',
    videoThumbnails: [
      { url: 'https://i.ytimg.com/vi/hNTMJtQMBmI/mqdefault.jpg', width: 320, height: 180, quality: 'medium' },
    ],
    author: 'N00bpanda',
    authorId: 'UCNjK3J02lhzA9YY8dQPEEWg',
    lengthSeconds: 3600,
    viewCount: 8500000,
    published: 1704067200,
  },
  {
    videoId: 'dQw4w9WgXcQ',
    title: 'Rick Astley - Never Gonna Give You Up',
    videoThumbnails: [
      { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg', width: 320, height: 180, quality: 'medium' },
    ],
    author: 'Rick Astley',
    authorId: 'UCuAXFkgsw1L7xaCfnd5JJOw',
    lengthSeconds: 212,
    viewCount: 1500000000,
    published: 1704067200,
  },
  {
    videoId: '9bZkp7q19f0',
    title: 'PSY - GANGNAM STYLE',
    videoThumbnails: [
      { url: 'https://i.ytimg.com/vi/9bZkp7q19f0/mqdefault.jpg', width: 320, height: 180, quality: 'medium' },
    ],
    author: 'officialpsy',
    authorId: 'UCr0i2OjXhXXiAlJEgJarjqQ',
    lengthSeconds: 252,
    viewCount: 5100000000,
    published: 1704067200,
  },
]

export async function fetchTrending(): Promise<InvidiousVideo[]> {
  return MOCK_VIDEOS
}

export async function fetchVideo(videoId: string): Promise<InvidiousVideo | null> {
  return MOCK_VIDEOS.find(v => v.videoId === videoId) || null
}

export async function searchVideos(query: string): Promise<InvidiousVideo[]> {
  const lowerQuery = query.toLowerCase()
  return MOCK_VIDEOS.filter(v =>
    v.title.toLowerCase().includes(lowerQuery) ||
    v.author.toLowerCase().includes(lowerQuery)
  )
}
