export interface ParsedSheet {
  embedBaseUrl: string
  gid: string
}

export function parseGoogleSheetsUrl(rawUrl: string): ParsedSheet | null {
  const trimmed = rawUrl.trim()
  if (!trimmed) {
    return null
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(trimmed)
  } catch {
    return null
  }

  const standardSpreadsheetMatch = parsedUrl.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  const publishedSpreadsheetMatch = parsedUrl.pathname.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)\/pubhtml/)

  let embedBaseUrl: string | null = null
  if (publishedSpreadsheetMatch) {
    embedBaseUrl = `https://docs.google.com/spreadsheets/d/e/${publishedSpreadsheetMatch[1]}/pubhtml`
  } else if (standardSpreadsheetMatch) {
    embedBaseUrl = `https://docs.google.com/spreadsheets/d/${standardSpreadsheetMatch[1]}/pubhtml`
  }

  if (!embedBaseUrl) {
    return null
  }

  const gidFromQuery = parsedUrl.searchParams.get('gid')

  let gidFromHash: string | null = null
  if (parsedUrl.hash) {
    const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''))
    gidFromHash = hashParams.get('gid')
  }

  const rawGid = gidFromQuery ?? gidFromHash ?? '0'
  const parsedGid = Number(rawGid)
  const gid = Number.isInteger(parsedGid) && parsedGid >= 0 ? String(parsedGid) : '0'

  return { embedBaseUrl, gid }
}

export function buildGoogleSheetsEmbedUrl(parsedSheet: ParsedSheet, range: string): string {
  const embedUrl = new URL(parsedSheet.embedBaseUrl)
  embedUrl.searchParams.set('gid', parsedSheet.gid)

  const trimmedRange = range.trim()
  if (trimmedRange) {
    embedUrl.searchParams.set('range', trimmedRange)
  }

  embedUrl.searchParams.set('widget', 'false')
  embedUrl.searchParams.set('headers', 'false')
  embedUrl.searchParams.set('chrome', 'false')

  return embedUrl.toString()
}

export function isLikelyUnpublishedOrRestrictedHtml(bodyText: string): boolean {
  const normalizedBody = bodyText.toLowerCase()
  const invalidMarkers = [
    'accounts.google.com',
    'sign in',
    'request access',
    'you need permission',
    'unable to open file',
  ]

  return invalidMarkers.some((marker) => normalizedBody.includes(marker))
}