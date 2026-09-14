'use strict';

const incidentRepository = require('../repositories/incidentRepository');

/**
 * GET /api/incidents
 * Returns the most recent 50 incident events.
 */
async function getIncidents(req, res) {
  try {
    const rows = await incidentRepository.getIncidents();
    res.json(rows);
  } catch (err) {
    console.error('[incidentController] getIncidents error:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getIncidents };
