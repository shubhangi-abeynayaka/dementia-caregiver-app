/**
 * @fileoverview useHistoryController — manages history-specific actions
 * that go beyond what useDeviceController exposes from context.
 *
 * Delegates HTTP calls to apiService and state mutations to the
 * setHistoryLogs callback provided by the parent controller/context.
 */

import { useCallback } from 'react'
import { apiService } from '@/services/apiService'

/**
 * @param {{ setHistoryLogs: Function, setError: Function }} deps
 */
export function useHistoryController({ setHistoryLogs, setError }) {
  const clearAllHistory = useCallback(async () => {
    try {
      const res = await apiService.request('/api/history/clear', { method: 'POST' })
      if (!res.ok) throw new Error(`History clear failed: ${res.status}`)
      localStorage.removeItem('orbitcare_history')
      setHistoryLogs([])
    } catch (err) {
      console.error('[useHistoryController] clearAllHistory failed:', err)
      setError?.(err)
    }
  }, [setHistoryLogs, setError])

  const deleteHistoryLog = useCallback((id) => {
    setHistoryLogs((prev) => prev.filter((e) => e.id !== id))
  }, [setHistoryLogs])

  return { clearAllHistory, deleteHistoryLog }
}
