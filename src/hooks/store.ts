import { createUseInstanceStoreState } from '@telemetryos/sdk/react'

export type BackgroundType = 'default' | 'solid'

export const useUiScaleStoreState = createUseInstanceStoreState<number>('ui-scale', 1)

export const useGoogleSheetsUrlStoreState = createUseInstanceStoreState<string>('google-sheets-url', '')

export const useCellRangeStoreState = createUseInstanceStoreState<string>('google-sheets-range', '')

export const useRefreshIntervalMinutesStoreState = createUseInstanceStoreState<string>('google-sheets-refresh-minutes', '15')

export const useBackgroundTypeStoreState = createUseInstanceStoreState<BackgroundType>('background-type', 'default')

export const useBackgroundColorStoreState = createUseInstanceStoreState<string>('background-color', '#000000')

export const useBackgroundOpacityStoreState = createUseInstanceStoreState<number>('background-opacity', 100)