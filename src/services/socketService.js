/**
 * @fileoverview Socket service — wraps socket.io-client to isolate the
 * real-time transport concern from controllers.
 */

import { io } from 'socket.io-client'
import { BACKEND_URL_CANDIDATES } from '@/models/device'

/**
 * @typedef {object} SocketHandlers
 * @property {(payload: unknown) => void} onTelemetry
 * @property {(payload: unknown) => void} [onSignal]
 * @property {() => void} onConnect
 * @property {() => void} onDisconnect
 * @property {(error: Error) => void} onConnectError
 */

/**
 * Creates a managed Socket.IO connection that tries each candidate backend URL
 * in sequence until one connects.
 *
 * Returns a handle with connect / disconnect methods.
 *
 * @param {SocketHandlers} handlers
 * @returns {{ connect: () => void, disconnect: () => void, dispose: () => void }}
 */
export function createSocketService(handlers) {
  let activeSocket = null
  let disposed = false

  function connectTo(candidateIndex) {
    if (disposed) return

    const url = BACKEND_URL_CANDIDATES[candidateIndex]
    const socket = io(url, { reconnection: false })
    activeSocket = socket

    socket.on('connect', () => {
      handlers.onConnect(url)
    })

    socket.on('telemetry', (payload) => {
      handlers.onTelemetry(payload)
    })

    // Dedicated event for orbitcare/signal commands (ALARM_ON, ALARM_OFF, SOS, RESET)
    socket.on('signal', (payload) => {
      handlers.onSignal?.(payload)
    })

    socket.on('disconnect', () => {
      handlers.onDisconnect()
    })

    socket.on('connect_error', (err) => {
      socket.disconnect()
      const hasNext = candidateIndex < BACKEND_URL_CANDIDATES.length - 1
      if (!disposed && hasNext) {
        connectTo(candidateIndex + 1)
        return
      }
      handlers.onConnectError(err, url)
    })
  }

  return {
    /** Begin the connection attempt sequence from the first candidate URL. */
    connect() {
      connectTo(0)
    },

    /** Disconnect the active socket (if any). Does not prevent reconnection. */
    disconnect() {
      activeSocket?.disconnect()
    },

    /**
     * Permanently dispose of this service instance. Removes all listeners and
     * prevents any future connection callbacks from firing.
     */
    dispose() {
      disposed = true
      if (activeSocket) {
        activeSocket.off('connect')
        activeSocket.off('telemetry')
        activeSocket.off('signal')
        activeSocket.off('disconnect')
        activeSocket.off('connect_error')
        activeSocket.disconnect()
        activeSocket = null
      }
    },
  }
}

