import { useEffect, useMemo, useState } from 'react'
import { useUiScaleToSetRem } from '@telemetryos/sdk/react'
import {
  useBackgroundColorStoreState,
  useBackgroundOpacityStoreState,
  useBackgroundTypeStoreState,
  useCellRangeStoreState,
  useGoogleSheetsPublishedValidStoreState,
  useGoogleSheetsUrlStoreState,
  useRefreshIntervalMinutesStoreState,
  useUiScaleStoreState,
} from '../hooks/store'
import { buildGoogleSheetsEmbedUrl, parseGoogleSheetsUrl } from '../utils/googleSheets'
import './Render.css'

const DEFAULT_REFRESH_MINUTES = 15
const MIN_REFRESH_MINUTES = 5
const MAX_REFRESH_MINUTES = 1440

interface FramePayload {
  id: number
  src: string
}

function parseRefreshMinutes(value: string): number {
  const parsed = Number(value.trim())
  if (!Number.isFinite(parsed)) {
    return DEFAULT_REFRESH_MINUTES
  }

  return Math.min(MAX_REFRESH_MINUTES, Math.max(MIN_REFRESH_MINUTES, parsed))
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
  const [isLoadingPublishedValid, isPublishedValid] = useGoogleSheetsPublishedValidStoreState()
  const [isLoadingBackgroundType, backgroundType] = useBackgroundTypeStoreState()
  const [isLoadingBackgroundColor, backgroundColor] = useBackgroundColorStoreState()
  const [isLoadingBackgroundOpacity, backgroundOpacity] = useBackgroundOpacityStoreState()

  useUiScaleToSetRem(uiScale)

  const isStoreLoading =
    isLoadingScale ||
    isLoadingUrl ||
    isLoadingRange ||
    isLoadingRefresh ||
    isLoadingPublishedValid ||
    isLoadingBackgroundType ||
    isLoadingBackgroundColor ||
    isLoadingBackgroundOpacity

  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine)
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

    return buildGoogleSheetsEmbedUrl(parsedSheet, cellRange)
  }, [parsedSheet, cellRange])

  const refreshMinutes = useMemo(() => parseRefreshMinutes(refreshIntervalMinutes), [refreshIntervalMinutes])

  useEffect(() => {
    if (!embedUrl || !isOnline || !isPublishedValid) {
      setActiveFrame(null)
      setPendingFrame(null)
      return
    }

    setActiveFrame(null)
    setPendingFrame({ id: Date.now(), src: embedUrl })
  }, [embedUrl, isOnline, isPublishedValid])

  useEffect(() => {
    if (!embedUrl || !isOnline || !isPublishedValid) {
      return
    }

    const intervalId = window.setInterval(() => {
      setPendingFrame({ id: Date.now(), src: embedUrl })
    }, refreshMinutes * 60 * 1000)

    return () => window.clearInterval(intervalId)
  }, [embedUrl, isOnline, refreshMinutes, isPublishedValid])

  if (isStoreLoading || !isOnline || !embedUrl || !isPublishedValid) {
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
          scrolling="no"
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
          scrolling="no"
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
