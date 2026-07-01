import { eng, por, porBr } from 'stopword'

function stripDiacritics(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

const STOPWORDS = new Set([...eng, ...por, ...porBr].map(stripDiacritics))

export function tokenize(text: string): string[] {
  return stripDiacritics(text)
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 3 && !/^\d+$/.test(t) && !STOPWORDS.has(t))
}
