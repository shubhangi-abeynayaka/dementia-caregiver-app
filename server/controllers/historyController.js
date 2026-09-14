'use strict';

const telemetryRepository = require('../repositories/telemetryRepository');

/**
 * GET /api/history
 * Returns up to 100 telemetry log entries, filtered by history_cleared_at if set.
 */
async function getHistory(req, res) {
  try {
    const clearedAt = await telemetryRepository.getHistoryClearedAt();
    const rows = await telemetryRepository.getHistory(clearedAt);
    res.json(rows);
  } catch (err) {
    console.error('[historyController] getHistory error:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/history/clear
 * Stamps the current time as the history cleared threshold.
 */
async function clearHistory(req, res) {
  try {
    const clearedAt = await telemetryRepository.stampHistoryCleared();
    res.json({ cleared_at: clearedAt });
  } catch (err) {
    console.error('[historyController] clearHistory error:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getHistory, clearHistory };
