import { useEffect, useMemo, useState } from 'react'
import { proxy } from '@telemetryos/sdk'
import { useUiScaleToSetRem } from '@telemetryos/sdk/react'
import {
  useBackgroundColorStoreState,
  useBackgroundOpacityStoreState,
  useBackgroundTypeStoreState,
  useCellRangeStoreState,
  useGoogleSheetsUrlStoreState,
  useRefreshIntervalMinutesStoreState,
  useUiScaleStoreState,
} from '../hooks/store'
import './Render.css'

const DEFAULT_REFRESH_MINUTES = 15
const MIN_REFRESH_MINUTES = 5
const MAX_REFRESH_MINUTES = 1440

interface ParsedSheet {
  embedBaseUrl: string
  gid: string
}

interface FramePayload {
  id: number
  src: string
}

function parseGoogleSheetsUrl(rawUrl: string): ParsedSheet | null {
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

function parseRefreshMinutes(value: string): number {
  const parsed = Number(value.trim())
  if (!Number.isFinite(parsed)) {
    return DEFAULT_REFRESH_MINUTES
  }

  return Math.min(MAX_REFRESH_MINUTES, Math.max(MIN_REFRESH_MINUTES, parsed))
}

function buildEmbedUrl(parsedSheet: ParsedSheet, range: string): string {
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

function hexToRgba(hexColor: string, opacityPercent: number): string {
  const normalized = hexColor.replace('#', '')
  const isShortHex = normalized.length === 3
  const fullHex = isShortHex
    ? normalized
      .split('')
      .map((char) => `${char}${char}`)
      .join('')
    : normalized

  if (!/^[0-9a-fA-F]{6}$/.test(fullHex)) {
    return 'rgba(0, 0, 0, 1)'
  }

  const red = Number.parseInt(fullHex.slice(0, 2), 16)
  const green = Number.parseInt(fullHex.slice(2, 4), 16)
  const blue = Number.parseInt(fullHex.slice(4, 6), 16)
  const alpha = Math.min(100, Math.max(0, opacityPercent)) / 100

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

export function Render() {
  const [isLoadingScale, uiScale] = useUiScaleStoreState()
  const [isLoadingUrl, googleSheetsUrl] = useGoogleSheetsUrlStoreState()
  const [isLoadingRange, cellRange] = useCellRangeStoreState()
  const [isLoadingRefresh, refreshIntervalMinutes] = useRefreshIntervalMinutesStoreState()
  const [isLoadingBackgroundType, backgroundType] = useBackgroundTypeStoreState()
  const [isLoadingBackgroundColor, backgroundColor] = useBackgroundColorStoreState()
  const [isLoadingBackgroundOpacity, backgroundOpacity] = useBackgroundOpacityStoreState()

  useUiScaleToSetRem(uiScale)

  const isStoreLoading =
    isLoadingScale ||
    isLoadingUrl ||
    isLoadingRange ||
    isLoadingRefresh ||
    isLoadingBackgroundType ||
    isLoadingBackgroundColor ||
    isLoadingBackgroundOpacity

  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [isValidatingEmbed, setIsValidatingEmbed] = useState<boolean>(false)
  const [isEmbedValid, setIsEmbedValid] = useState<boolean>(false)
  const [activeFrame, setActiveFrame] = useState<FramePayload | null>(null)
  const [pendingFrame, setPendingFrame] = useState<FramePayload | null>(null)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const parsedSheet = useMemo(() => parseGoogleSheetsUrl(googleSheetsUrl), [googleSheetsUrl])
  const embedUrl = useMemo(() => {
    if (!parsedSheet) {
      return null
    }

    return buildEmbedUrl(parsedSheet, cellRange)
  }, [parsedSheet, cellRange])

  const refreshMinutes = useMemo(() => parseRefreshMinutes(refreshIntervalMinutes), [refreshIntervalMinutes])

  useEffect(() => {
    if (!embedUrl || !isOnline) {
      setIsValidatingEmbed(false)
      setIsEmbedValid(false)
      return
    }

    let isCancelled = false
    setIsValidatingEmbed(true)
    setIsEmbedValid(false)

    const validatePublishedSheet = async () => {
      try {
        const response = await proxy().fetch(embedUrl)
        if (!response.ok) {
          if (!isCancelled) {
            setIsEmbedValid(false)
          }
          return
        }

        // Cross-origin iframe content is not readable, so use an HTML marker heuristic via proxy.
        const bodyText = (await response.text()).toLowerCase()
        const invalidMarkers = [
          'accounts.google.com',
          'sign in',
          'request access',
          'you need permission',
          'unable to open file',
        ]

        const hasInvalidMarker = invalidMarkers.some((marker) => bodyText.includes(marker))
        if (!isCancelled) {
          setIsEmbedValid(!hasInvalidMarker)
        }
      } catch {
        if (!isCancelled) {
          setIsEmbedValid(false)
        }
      } finally {
        if (!isCancelled) {
          setIsValidatingEmbed(false)
        }
      }
    }

    validatePublishedSheet()

    return () => {
      isCancelled = true
    }
  }, [embedUrl, isOnline])

  useEffect(() => {
    if (!embedUrl || !isOnline || isValidatingEmbed || !isEmbedValid) {
      setActiveFrame(null)
      setPendingFrame(null)
      return
    }

    setActiveFrame(null)
    setPendingFrame({ id: Date.now(), src: embedUrl })
  }, [embedUrl, isOnline, isValidatingEmbed, isEmbedValid])

  useEffect(() => {
    if (!embedUrl || !isOnline || isValidatingEmbed || !isEmbedValid) {
      return
    }

    const intervalId = window.setInterval(() => {
      setPendingFrame({ id: Date.now(), src: embedUrl })
    }, refreshMinutes * 60 * 1000)

    return () => window.clearInterval(intervalId)
  }, [embedUrl, isOnline, refreshMinutes, isValidatingEmbed, isEmbedValid])

  if (isStoreLoading || !isOnline || !embedUrl || isValidatingEmbed || !isEmbedValid) {
    return null
  }

  const backgroundStyle =
    backgroundType === 'solid'
      ? hexToRgba(backgroundColor, backgroundOpacity)
      : `rgba(0, 0, 0, ${Math.min(100, Math.max(0, backgroundOpacity)) / 100})`

  return (
    <div className="render" style={{ backgroundColor: backgroundStyle }}>
      {activeFrame && (
        <iframe
          key={`active-${activeFrame.id}`}
          className="sheets-frame sheets-frame--active"
          src={activeFrame.src}
          title="Google Sheets"
          loading="eager"
          referrerPolicy="no-referrer-when-downgrade"
        />
      )}

      {pendingFrame && (
        <iframe
          key={`pending-${pendingFrame.id}`}
          className="sheets-frame sheets-frame--pending"
          src={pendingFrame.src}
          title="Google Sheets loading"
          loading="eager"
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={() => {
            setActiveFrame(pendingFrame)
            setPendingFrame(null)
          }}
          onError={() => {
            setActiveFrame(null)
            setPendingFrame(null)
          }}
        />
      )}
    </div>
  )
}
