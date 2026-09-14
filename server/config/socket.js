'use strict';

/**
 * Manages all Socket.IO server-side wiring.
 * Call `init(httpServer)` once from the entry point, then use `broadcast()`
 * anywhere in the application to push events to all connected clients.
 */

const { Server } = require('socket.io');

const allowedOrigins = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
  /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
];

/** @type {import('socket.io').Server | null} */
let io = null;

/**
 * Initialise Socket.IO on the given HTTP server.
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
function init(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: allowedOrigins },
  });

  io.on('connection', (socket) => {
    console.log(`[socket] Client connected:    ${socket.id}`);
    socket.on('disconnect', () => {
      console.log(`[socket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

/**
 * Emit an event to every connected Socket.IO client.
 * @param {string} event
 * @param {unknown} data
 */
function broadcast(event, data) {
  if (!io) throw new Error('[socket] Socket.IO not initialised — call init() first.');
  io.emit(event, data);
}

/**
 * Returns the raw Socket.IO server instance (useful for advanced room logic).
 * @returns {import('socket.io').Server}
 */
function getIo() {
  if (!io) throw new Error('[socket] Socket.IO not initialised — call init() first.');
  return io;
}

module.exports = { init, broadcast, getIo, allowedOrigins };
