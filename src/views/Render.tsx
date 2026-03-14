import { useEffect, useMemo, useState } from 'react'
import { useUiAspectRatio, useUiResponsiveFactors, useUiScaleToSetRem } from '@telemetryos/sdk/react'
import {
  useBackgroundColorStoreState,
  useBackgroundOpacityStoreState,
  useBackgroundTypeStoreState,
  useCellRangeStoreState,
  useGoogleSheetsPublishedValidStoreState,
  useGoogleSheetsUrlStoreState,
  useUiScaleStoreState,
} from '../hooks/store'
import { buildGoogleSheetsEmbedUrl, parseGoogleSheetsUrl } from '../utils/googleSheets'
import './Render.css'

// Constants removed

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

  useUiScaleToSetRem(uiScale)

  const uiAspectRatio = useUiAspectRatio()
  const { uiWidthFactor, uiHeightFactor } = useUiResponsiveFactors(uiScale, uiAspectRatio)

  const isStoreLoading =
    isLoadingScale ||
    isLoadingUrl ||
    isLoadingRange ||
    isLoadingPublishedValid ||
    isLoadingBackgroundType ||
    isLoadingBackgroundColor ||
    isLoadingBackgroundOpacity

  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine)

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
    if (!parsedSheet || !isOnline || !isPublishedValid) {
      return null
    }

    return buildGoogleSheetsEmbedUrl(parsedSheet, cellRange)
  }, [parsedSheet, cellRange, isOnline, isPublishedValid])

  if (isStoreLoading || !isOnline || !embedUrl || !isPublishedValid) {
    return null
  }

  const backgroundStyle =
    backgroundType === 'solid'
      ? hexToRgba(backgroundColor, backgroundOpacity)
      : `rgba(0, 0, 0, ${Math.min(100, Math.max(0, backgroundOpacity)) / 100})`

  const NATIVE_ASPECT_RATIO = 16 / 9
  const isPillarbox = uiAspectRatio > NATIVE_ASPECT_RATIO

  return (
    <div className="render" style={{ backgroundColor: backgroundStyle }}>
      <div className="render__stage" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="render__viewport" style={{
          width: isPillarbox ? `calc(100vh * ${NATIVE_ASPECT_RATIO})` : '100vw',
          height: isPillarbox ? '100vh' : `calc(100vw / ${NATIVE_ASPECT_RATIO})`,
          maxWidth: '100vw',
          maxHeight: '100vh',
        }}>
          <iframe
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
