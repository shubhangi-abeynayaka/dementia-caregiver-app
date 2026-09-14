/**
 * @fileoverview API service — manages HTTP calls to the backend with
 * automatic fallback across multiple candidate URLs.
 */

import { BACKEND_URL_CANDIDATES } from '@/models/device'

/**
 * Creates an API service instance that retries requests across all candidate
 * backend URLs, caching the first one that responds successfully.
 *
 * @returns {{ request: (path: string, options?: RequestInit) => Promise<Response> }}
 */
export function createApiService() {
  // Mutable ref to the last known-good backend URL
  let activeUrl = null

  /**
   * Make an HTTP request, trying each candidate URL in order until one succeeds.
   * @param {string} path  e.g. '/api/history'
   * @param {RequestInit} [options]
   * @returns {Promise<Response>}
   */
  async function request(path, options = {}) {
    const candidates = [
      activeUrl,
      ...BACKEND_URL_CANDIDATES,
    ].filter((url, i, arr) => url && arr.indexOf(url) === i)

    let lastError

    for (const url of candidates) {
      try {
        const response = await fetch(`${url}${path}`, options)
        activeUrl = url
        return response
      } catch (err) {
        if (err.name === 'AbortError') throw err
        lastError = err
      }
    }

    throw lastError ?? new Error('Unable to connect to backend')
  }

  return { request }
}

/**
 * Singleton API service instance for use across the app.
 * Import this directly rather than calling createApiService() each time.
 */
export const apiService = createApiService()
