import { useEffect, useMemo, useState } from 'react'
import { useUiAspectRatio, useUiResponsiveFactors, useUiScaleToSetRem } from '@telemetryos/sdk/react'
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
  const [isLoadingPublishedValid, isPublishedValid] = useGoogleSheetsPublishedValidStoreState()
  const [isLoadingBackgroundType, backgroundType] = useBackgroundTypeStoreState()
  const [isLoadingBackgroundColor, backgroundColor] = useBackgroundColorStoreState()
  const [isLoadingBackgroundOpacity, backgroundOpacity] = useBackgroundOpacityStoreState()
  const [isLoadingRefresh, refreshMinutes] = useRefreshIntervalMinutesStoreState()

  useUiScaleToSetRem(uiScale)
  const uiAspectRatio = useUiAspectRatio()
  const { uiWidthFactor, uiHeightFactor } = useUiResponsiveFactors(uiScale, uiAspectRatio)

  const [contentKey, setContentKey] = useState(0)
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine)

  const isStoreLoading =
    isLoadingScale ||
    isLoadingUrl ||
    isLoadingRange ||
    isLoadingPublishedValid ||
    isLoadingBackgroundType ||
    isLoadingBackgroundColor ||
    isLoadingBackgroundOpacity ||
    isLoadingRefresh

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
    if (!parsedSheet || !isOnline || !isPublishedValid) return null
    return buildGoogleSheetsEmbedUrl(parsedSheet, cellRange)
  }, [parsedSheet, cellRange, isOnline, isPublishedValid])

  useEffect(() => {
    if (isStoreLoading || !embedUrl) return
    const intervalMs = Math.max(5, Math.min(1440, Number.parseInt(refreshMinutes) || 15)) * 60 * 1000
    const timer = setInterval(() => {
      setContentKey((prev) => prev + 1)
    }, intervalMs)
    return () => clearInterval(timer)
  }, [isStoreLoading, refreshMinutes, embedUrl])

  if (isStoreLoading || !isOnline || !embedUrl || !isPublishedValid) {
    return null
  }

  const backgroundStyle =
    backgroundType === 'solid'
      ? hexToRgba(backgroundColor, backgroundOpacity)
      : `rgba(0, 0, 0, ${Math.min(100, Math.max(0, backgroundOpacity)) / 100})`

  // SCALE TO MAXIMUM SIZE AT NATIVE ASPECT RATIO (16:9)
  // This implements the requested pillarbox/letterbox behavior.
  const NATIVE_RATIO = 16 / 9
  const isPillarbox = uiAspectRatio > NATIVE_RATIO

  return (
    <div className="render" style={{ backgroundColor: backgroundStyle }}>
      <div className="render__stage">
        <div
          className="render__viewport"
          style={{
            width: isPillarbox ? `calc(100% * (${NATIVE_RATIO} / ${uiAspectRatio}))` : '100%',
            height: isPillarbox ? '100%' : `calc(100% * (${uiAspectRatio} / ${NATIVE_RATIO}))`,
          }}
        >
          <iframe
            key={`${embedUrl}-${contentKey}`}
            className="sheets-frame"
            src={embedUrl}
            title="Google Sheets"
            scrolling="no"
            loading="eager"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </div>
  )
}
