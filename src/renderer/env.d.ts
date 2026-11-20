/// <reference types="vite/client" />

import type { SableBridgeAPI } from '@shared/types'

declare global {
  interface Window {
    sable: SableBridgeAPI
  }
}

export {}
