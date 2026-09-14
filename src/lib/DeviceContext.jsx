/**
 * @fileoverview DeviceContext — thin React context provider.
 *
 * All logic lives in useDeviceController. This file's only job is to:
 *   1. Call the controller hook
 *   2. Expose the result via React context
 *   3. Export the useDevice() consumer hook
 */

import { createContext, useContext } from 'react'
import { useDeviceController } from '@/controllers/useDeviceController'

const DeviceContext = createContext(null)

export function DeviceProvider({ children }) {
  const value = useDeviceController()
  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>
}

export function useDevice() {
  const context = useContext(DeviceContext)
  if (!context) throw new Error('useDevice must be used within DeviceProvider')
  return context
}
