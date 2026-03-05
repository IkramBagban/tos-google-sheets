import { useEffect, useMemo, useState } from 'react'
import { proxy } from '@telemetryos/sdk'
import {
  SettingsContainer,
  SettingsError,
  SettingsField,
  SettingsHeading,
  SettingsHint,
  SettingsInputFrame,
  SettingsLabel,
  SettingsSection,
  SettingsSelectFrame,
  SettingsSliderFrame,
} from '@telemetryos/sdk/react'
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
import { buildGoogleSheetsEmbedUrl, isLikelyUnpublishedOrRestrictedHtml, parseGoogleSheetsUrl } from '../utils/googleSheets'

const DEFAULT_REFRESH_MINUTES = 15
const MIN_REFRESH_MINUTES = 5
const MAX_REFRESH_MINUTES = 1440
const SETTINGS_VALIDATION_DEBOUNCE_MS = 600

function isValidGoogleSheetsInputUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) {
    return true
  }

  try {
    const parsed = new URL(trimmed)
    if (parsed.hostname !== 'docs.google.com') {
      return false
    }

    const isStandardSheetsUrl = /\/spreadsheets\/d\/[a-zA-Z0-9-_]+/.test(parsed.pathname)
    const isPublishedSheetsUrl = /\/spreadsheets\/d\/e\/[a-zA-Z0-9-_]+\/pubhtml/.test(parsed.pathname)

    return isStandardSheetsUrl || isPublishedSheetsUrl
  } catch {
    return false
  }
}

function getRefreshInputError(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const numericValue = Number(trimmed)
  if (!Number.isFinite(numericValue)) {
    return `Invalid number. Render falls back to ${DEFAULT_REFRESH_MINUTES} minutes.`
  }

  if (numericValue < MIN_REFRESH_MINUTES || numericValue > MAX_REFRESH_MINUTES) {
    return `Out of range. Render clamps this to ${MIN_REFRESH_MINUTES}-${MAX_REFRESH_MINUTES} minutes.`
  }

  return null
}

export function Settings() {
  const [isLoadingScale, uiScale, setUiScale] = useUiScaleStoreState(5)
  const [isLoadingUrl, googleSheetsUrl, setGoogleSheetsUrl] = useGoogleSheetsUrlStoreState(250)
  const [isLoadingRange, cellRange, setCellRange] = useCellRangeStoreState(250)
  const [isLoadingRefresh, refreshIntervalMinutes, setRefreshIntervalMinutes] = useRefreshIntervalMinutesStoreState(250)
  const [isLoadingPublishedValid, isPublishedValid, setIsPublishedValid] = useGoogleSheetsPublishedValidStoreState(5)

  const [isLoadingBackgroundType, backgroundType, setBackgroundType] = useBackgroundTypeStoreState()
  const [isLoadingBackgroundColor, backgroundColor, setBackgroundColor] = useBackgroundColorStoreState(5)
  const [isLoadingBackgroundOpacity, backgroundOpacity, setBackgroundOpacity] = useBackgroundOpacityStoreState(5)

  const isLoading =
    isLoadingScale ||
    isLoadingUrl ||
    isLoadingRange ||
    isLoadingRefresh ||
    isLoadingPublishedValid ||
    isLoadingBackgroundType ||
    isLoadingBackgroundColor ||
    isLoadingBackgroundOpacity

  const urlError = isValidGoogleSheetsInputUrl(googleSheetsUrl)
    ? null
    : 'Enter a valid Google Sheets URL with /spreadsheets/d/{id} or a published /spreadsheets/d/e/{id}/pubhtml link.'
  const refreshError = getRefreshInputError(refreshIntervalMinutes)
  const [publishValidationStatus, setPublishValidationStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle')
  const [publishValidationError, setPublishValidationError] = useState<string | null>(null)

  const parsedSheet = useMemo(() => parseGoogleSheetsUrl(googleSheetsUrl), [googleSheetsUrl])
  const embedValidationUrl = useMemo(() => {
    if (!parsedSheet) {
      return null
    }

    return buildGoogleSheetsEmbedUrl(parsedSheet, cellRange)
  }, [parsedSheet, cellRange])

  useEffect(() => {
    if (!googleSheetsUrl.trim() || urlError || !embedValidationUrl) {
      setPublishValidationStatus('idle')
      setPublishValidationError(null)
      if (isPublishedValid) {
        setIsPublishedValid(false)
      }
      return
    }

    let isCancelled = false
    setPublishValidationStatus('checking')
    setPublishValidationError(null)
    if (isPublishedValid) {
      setIsPublishedValid(false)
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await proxy().fetch(embedValidationUrl)
        const bodyText = await response.text()
        const hasInvalidMarker = isLikelyUnpublishedOrRestrictedHtml(bodyText)
        const hasEmbeddableHtml = bodyText.trim().length > 0

        if (!isCancelled) {
          if (hasInvalidMarker) {
            setPublishValidationStatus('invalid')
            setPublishValidationError('This URL is shared but not web-published (or still restricted). In Google Sheets use File → Share → Publish to web, then use that published sheet.')
          } else if (response.ok || hasEmbeddableHtml) {
            setPublishValidationStatus('valid')
            setPublishValidationError(null)
            setIsPublishedValid(true)
          } else {
            setPublishValidationStatus('invalid')
            setPublishValidationError('This sheet could not be validated as web-published. Public sharing alone is not enough for signage embedding.')
          }
        }
      } catch {
        if (!isCancelled) {
          setPublishValidationStatus('invalid')
          setPublishValidationError('Unable to validate sheet accessibility right now. Check network access and publish status.')
        }
      }
    }, SETTINGS_VALIDATION_DEBOUNCE_MS)

    return () => {
      isCancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [googleSheetsUrl, urlError, embedValidationUrl])

  return (
    <SettingsContainer>
      <SettingsSection title="Google Sheets">
        <SettingsHeading>Sheet Source</SettingsHeading>

        <SettingsField>
          <SettingsLabel>Google Sheets URL</SettingsLabel>
          <SettingsInputFrame>
            <input
              type="text"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              disabled={isLoading}
              value={googleSheetsUrl}
              onChange={(event) => setGoogleSheetsUrl(event.target.value)}
            />
          </SettingsInputFrame>
          <SettingsHint>
            Publish the sheet to web in Google Sheets, then paste any sheet URL. If a tab is selected, its `gid` is used.
          </SettingsHint>
          {urlError && <SettingsError>{urlError}</SettingsError>}
          {!urlError && publishValidationStatus === 'checking' && (
            <SettingsHint>Checking whether this sheet is publicly published…</SettingsHint>
          )}
          {!urlError && publishValidationStatus === 'valid' && (
            <SettingsHint>Published sheet confirmed and ready to display.</SettingsHint>
          )}
          {!urlError && publishValidationStatus === 'invalid' && publishValidationError && (
            <SettingsError>{publishValidationError}</SettingsError>
          )}
        </SettingsField>

        <SettingsField>
          <SettingsLabel>Cell Range (Optional)</SettingsLabel>
          <SettingsInputFrame>
            <input
              type="text"
              placeholder="A1:F20"
              disabled={isLoading}
              value={cellRange}
              onChange={(event) => setCellRange(event.target.value)}
            />
          </SettingsInputFrame>
          <SettingsHint>Leave blank to show the full sheet.</SettingsHint>
        </SettingsField>

        <SettingsField>
          <SettingsLabel>Refresh Interval (Minutes)</SettingsLabel>
          <SettingsInputFrame>
            <input
              type="text"
              placeholder="15"
              disabled={isLoading}
              value={refreshIntervalMinutes}
              onChange={(event) => setRefreshIntervalMinutes(event.target.value)}
            />
          </SettingsInputFrame>
          <SettingsHint>Valid range is 5 to 1440 minutes.</SettingsHint>
          {refreshError && <SettingsError>{refreshError}</SettingsError>}
        </SettingsField>
      </SettingsSection>

      <SettingsSection title="Appearance">
        <SettingsField>
          <SettingsLabel>UI Scale</SettingsLabel>
          <SettingsSliderFrame>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              disabled={isLoading}
              value={uiScale}
              onChange={(event) => setUiScale(Number(event.target.value))}
            />
            <span>{uiScale.toFixed(2)}x</span>
          </SettingsSliderFrame>
        </SettingsField>

        <SettingsHeading>Background</SettingsHeading>

        <SettingsField>
          <SettingsLabel>Background Type</SettingsLabel>
          <SettingsSelectFrame>
            <select
              disabled={isLoading}
              value={backgroundType}
              onChange={(event) => setBackgroundType(event.target.value as 'default' | 'solid')}
            >
              <option value="default">Default</option>
              <option value="solid">Solid Color</option>
            </select>
          </SettingsSelectFrame>
        </SettingsField>

        {backgroundType === 'solid' && (
          <SettingsField>
            <SettingsLabel>Background Color</SettingsLabel>
            <SettingsInputFrame>
              <input
                type="color"
                disabled={isLoading}
                value={backgroundColor}
                onChange={(event) => setBackgroundColor(event.target.value)}
              />
            </SettingsInputFrame>
          </SettingsField>
        )}

        <SettingsField>
          <SettingsLabel>Background Opacity</SettingsLabel>
          <SettingsSliderFrame>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              disabled={isLoading}
              value={backgroundOpacity}
              onChange={(event) => setBackgroundOpacity(Number(event.target.value))}
            />
            <span>{backgroundOpacity}%</span>
          </SettingsSliderFrame>
        </SettingsField>
      </SettingsSection>
    </SettingsContainer>
  )
}
