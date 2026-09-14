'use strict';

const { Router } = require('express');
const historyController = require('../controllers/historyController');

const router = Router();

router.get('/', historyController.getHistory);
router.post('/clear', historyController.clearHistory);

module.exports = router;
